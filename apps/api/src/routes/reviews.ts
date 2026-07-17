import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthUser } from '../lib/auth.js';
import { requireRoles } from '../lib/auth.js';
import { prisma } from '../db.js';
import { logAudit } from '../lib/audit.js';

const reviewSchema = z.object({
  decision: z.enum(['APPROVE', 'RETURN', 'ESCALATE_QA']),
  comment: z.string().optional(),
  returnItems: z.array(z.string()).optional(),
});

export async function reviewRoutes(app: FastifyInstance) {
  app.get('/pending', { preHandler: [requireRoles('PM', 'QA')] }, async (request) => {
    const user = request.user as AuthUser;

    if (user.role === 'PM') {
      const packs = await prisma.actionPack.findMany({
        where: { status: 'SUBMITTED' },
        include: {
          monitoringVisit: {
            include: {
              project: true,
              site: true,
              cra: { select: { name: true } },
            },
          },
          items: true,
        },
        orderBy: { submittedAt: 'desc' },
      });

      return {
        reviews: packs.map((p) => ({
          id: p.id,
          type: 'ACTION_PACK',
          status: 'PENDING_PM_REVIEW',
          submittedAt: p.submittedAt?.toISOString(),
          visit: {
            id: p.monitoringVisit.id,
            type: p.monitoringVisit.type,
            project: p.monitoringVisit.project,
            site: p.monitoringVisit.site,
            cra: p.monitoringVisit.cra,
            workSummary: p.monitoringVisit.workSummary,
          },
          itemCount: p.items.length,
          riskItems: p.items.filter((i) =>
            ['RISK_CANDIDATE', 'CAPA_CANDIDATE'].includes(i.type),
          ),
        })),
      };
    }

    // QA: escalated items
    const escalatedVisits = await prisma.monitoringVisit.findMany({
      where: { status: 'PENDING_QA_REVIEW' },
      include: {
        project: true,
        site: true,
        cra: { select: { name: true } },
        actionPacks: { include: { items: true, reviews: true } },
      },
    });

    return {
      reviews: escalatedVisits.map((v) => ({
        id: v.id,
        type: 'QA_ESCALATION',
        status: 'PENDING_QA_REVIEW',
        visit: v,
      })),
    };
  });

  app.post('/action-packs/:packId', { preHandler: [requireRoles('PM', 'QA')] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { packId } = request.params as { packId: string };
    const body = reviewSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: '参数无效' } });
    }

    const pack = await prisma.actionPack.findUnique({
      where: { id: packId },
      include: { monitoringVisit: true, items: true },
    });

    if (!pack) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '工作包不存在' } });
    }

    const review = await prisma.review.create({
      data: {
        actionPackId: packId,
        reviewerId: user.id,
        decision: body.data.decision,
        comment: body.data.comment,
        returnItems: body.data.returnItems ? JSON.stringify(body.data.returnItems) : null,
      },
    });

    // 关闭 PM 审核 todo（按 sourceType=ACTION_PACK, sourceId=packId 关闭）
    await prisma.todo.updateMany({
      where: { sourceType: 'ACTION_PACK', sourceId: packId, status: 'OPEN' },
      data: { status: 'CLOSED' },
    });

    // 关闭工作包（按决定标记），否则 reviews/pending 仍会返回
    await prisma.actionPack.update({
      where: { id: packId },
      data: {
        status: body.data.decision === 'APPROVE' ? 'APPROVED' : body.data.decision === 'RETURN' ? 'RETURNED' : 'ESCALATED_QA',
      },
    });

    let visitStatus = pack.monitoringVisit.status;

    if (body.data.decision === 'APPROVE') {
      visitStatus = 'APPROVED';
      await prisma.monitoringVisit.update({
        where: { id: pack.monitoringVisitId },
        data: { status: 'APPROVED' },
      });
      await prisma.issue.updateMany({
        where: {
          monitoringVisitId: pack.monitoringVisitId,
          status: 'CRA_CONFIRMED',
        },
        data: { status: 'OPEN' },
      });
      await prisma.hoursRecord.updateMany({
        where: {
          monitoringVisitId: pack.monitoringVisitId,
          status: 'CRA_CONFIRMED',
        },
        data: { status: 'APPROVED' },
      });
    } else if (body.data.decision === 'RETURN') {
      visitStatus = 'PM_RETURNED';
      await prisma.monitoringVisit.update({
        where: { id: pack.monitoringVisitId },
        data: { status: 'PM_RETURNED' },
      });

      if (body.data.returnItems?.length) {
        for (const itemId of body.data.returnItems) {
          await prisma.actionItem.update({
            where: { id: itemId },
            data: { status: 'RETURNED' },
          });
        }
      }

      await prisma.todo.create({
        data: {
          userId: pack.monitoringVisit.craId,
          title: 'PM退回 - 需补充',
          description: body.data.comment || '请根据PM意见补充',
          group: 'NOW',
          sourceType: 'REVIEW',
          sourceId: review.id,
          monitoringVisitId: pack.monitoringVisitId,
          projectId: pack.monitoringVisit.projectId,
          siteId: pack.monitoringVisit.siteId,
        },
      });
    } else if (body.data.decision === 'ESCALATE_QA') {
      visitStatus = 'PENDING_QA_REVIEW';
      await prisma.monitoringVisit.update({
        where: { id: pack.monitoringVisitId },
        data: { status: 'PENDING_QA_REVIEW' },
      });
    }

    await logAudit({
      type: user.role === 'QA' ? 'QA_REVIEW' : 'PM_REVIEW',
      userId: user.id,
      entityType: 'ActionPack',
      entityId: packId,
      payload: { decision: body.data.decision, comment: body.data.comment },
    });

    return { review, visitStatus };
  });

  app.post('/qa/:visitId', { preHandler: [requireRoles('QA')] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { visitId } = request.params as { visitId: string };
    const body = reviewSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: '参数无效' } });
    }

    const visit = await prisma.monitoringVisit.findUnique({ where: { id: visitId } });
    if (!visit || visit.status !== 'PENDING_QA_REVIEW') {
      return reply.status(400).send({ error: { code: 'INVALID_STATUS', message: '访视状态无效' } });
    }

    const newStatus = body.data.decision === 'APPROVE' ? 'APPROVED' : 'PM_RETURNED';
    await prisma.monitoringVisit.update({
      where: { id: visitId },
      data: { status: newStatus },
    });

    await logAudit({
      type: 'QA_REVIEW',
      userId: user.id,
      entityType: 'MonitoringVisit',
      entityId: visitId,
      payload: { decision: body.data.decision },
    });

    return { visitStatus: newStatus };
  });
}