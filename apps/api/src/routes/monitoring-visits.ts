import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthUser } from '../lib/auth.js';
import { userHasProjectAccess } from '../lib/auth.js';
import { prisma } from '../db.js';
import { logAudit } from '../lib/audit.js';
import { completeVisit, ensureVisitActivities } from '../lib/action-pack.js';

const startSchema = z.object({
  actualStartTime: z.string().datetime().optional(),
});

const endSchema = z.object({
  actualEndTime: z.string().datetime().optional(),
});

const completeSchema = z.object({
  actualEndTime: z.string().datetime().optional(),
  clientRequestId: z.string().optional(),
});

const patchVisitSchema = z.object({
  actualEndTime: z.string().datetime().optional(),
  actualStartTime: z.string().datetime().optional(),
  workSummary: z.string().optional(),
});

const inputSchema = z.object({
  type: z.enum(['TEXT', 'VOICE', 'IMAGE', 'FILE']),
  content: z.string().min(1),
  transcript: z.string().optional(),
  clientInputId: z.string().optional(),
});

const updateInputSchema = z.object({
  content: z.string().min(1),
  transcript: z.string().optional(),
  reason: z.string().min(1, '修改原因必填'),
});

const voidInputSchema = z.object({
  reason: z.string().min(1, '作废原因必填'),
});

const activityUpdateSchema = z.object({
  status: z.enum(['PENDING', 'DONE', 'PARTIAL', 'NA']).optional(),
  note: z.string().optional(),
  relatedIssueIds: z.array(z.string()).optional(),
  evidenceIds: z.array(z.string()).optional(),
});

const ENDED_OR_LATER = [
  'PENDING_WRAP_UP',
  'PENDING_CRA_CONFIRM',
  'PENDING_PM_REVIEW',
  'PM_RETURNED',
  'PENDING_QA_REVIEW',
  'APPROVED',
];

export async function monitoringVisitRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as AuthUser;
    const visits = await prisma.monitoringVisit.findMany({
      where: { craId: user.id },
      include: { project: true, site: true },
      orderBy: { plannedDate: 'desc' },
      take: 50,
    });

    return {
      visits: visits.map((v) => ({
        id: v.id,
        type: v.type,
        status: v.status,
        plannedDate: v.plannedDate.toISOString(),
        actualStartTime: v.actualStartTime?.toISOString(),
        actualEndTime: v.actualEndTime?.toISOString(),
        project: { id: v.project.id, code: v.project.code, name: v.project.name },
        site: { id: v.site.id, name: v.site.name, code: v.site.code },
        subjectsReviewed: v.subjectsReviewed,
        workSummary: v.workSummary,
      })),
    };
  });

  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const visit = await prisma.monitoringVisit.findUnique({
      where: { id },
      include: {
        project: true,
        site: true,
        cra: { select: { id: true, name: true } },
        inputs: {
          where: { isVoided: false },
          orderBy: { createdAt: 'asc' },
        },
        activities: { orderBy: { sortOrder: 'asc' } },
        attachments: true,
        issues: true,
        actionPacks: {
          where: { isActive: true },
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
        reportDraft: true,
        followUpItems: true,
      },
    });

    if (!visit) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '访视不存在' } });
    }

    const durationMinutes =
      visit.actualStartTime && visit.actualEndTime
        ? Math.round((visit.actualEndTime.getTime() - visit.actualStartTime.getTime()) / 60000)
        : visit.actualStartTime
          ? Math.round((Date.now() - visit.actualStartTime.getTime()) / 60000)
          : null;

    return {
      visit: {
        ...visit,
        plannedDate: visit.plannedDate.toISOString(),
        actualStartTime: visit.actualStartTime?.toISOString(),
        actualEndTime: visit.actualEndTime?.toISOString(),
        durationMinutes,
        sitePersonnel: visit.sitePersonnel ? JSON.parse(visit.sitePersonnel) : [],
        findings: visit.findings ? JSON.parse(visit.findings) : [],
        inputs: visit.inputs.map((i) => ({
          ...i,
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString(),
          voidedAt: i.voidedAt?.toISOString() ?? null,
        })),
        activities: visit.activities.map((a) => ({
          ...a,
          relatedIssueIds: a.relatedIssueIds ? JSON.parse(a.relatedIssueIds) : [],
          evidenceIds: a.evidenceIds ? JSON.parse(a.evidenceIds) : [],
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        })),
      },
    };
  });

  app.get('/:id/brief', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const visit = await prisma.monitoringVisit.findUnique({
      where: { id },
      include: { project: true, site: true },
    });

    if (!visit) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '访视不存在' } });
    }

    const openIssues = await prisma.issue.findMany({
      where: {
        projectId: visit.projectId,
        siteId: visit.siteId,
        status: { in: ['OPEN', 'IN_PROGRESS', 'CRA_CONFIRMED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      brief: {
        visit: {
          id: visit.id,
          type: visit.type,
          status: visit.status,
          plannedDate: visit.plannedDate.toISOString(),
          project: visit.project,
          site: visit.site,
        },
        enrollmentSummary: {
          note: '入组概况来自项目配置，V1 不提供 SubjectVisit 管理',
          screened: null,
          enrolled: null,
        },
        openIssues,
        focusAreas: [
          '核对受试者原始记录',
          '检查药物管理文件',
          '确认知情同意文件完整性',
          '跟进历史未关闭 Issue',
        ],
      },
    };
  });

  app.post('/:id/start', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };
    const body = startSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: '参数无效' } });
    }

    const visit = await prisma.monitoringVisit.findUnique({ where: { id } });
    if (!visit) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '访视不存在' } });
    }

    if (!['PLANNED', 'IN_PROGRESS'].includes(visit.status)) {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: '当前状态无法开始访视' },
      });
    }

    const hasAccess = await userHasProjectAccess(user.id, visit.projectId, visit.siteId);
    if (!hasAccess) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: '无权限' } });
    }

    const startTime = body.data.actualStartTime
      ? new Date(body.data.actualStartTime)
      : new Date();

    const updated = await prisma.monitoringVisit.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        actualStartTime: visit.actualStartTime ?? startTime,
      },
      include: { project: true, site: true },
    });

    await ensureVisitActivities(id, visit.type);

    await logAudit({
      type: 'VISIT_STARTED',
      userId: user.id,
      entityType: 'MonitoringVisit',
      entityId: id,
      payload: { actualStartTime: (visit.actualStartTime ?? startTime).toISOString() },
    });

    return { visit: updated };
  });

  /** Idempotent end: already ended returns current visit without error */
  app.post('/:id/end', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };
    const body = endSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: '参数无效' } });
    }

    const visit = await prisma.monitoringVisit.findUnique({
      where: { id },
      include: {
        actionPacks: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!visit) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '访视不存在' } });
    }

    if (visit.status === 'PLANNED') {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: '访视尚未开始' },
      });
    }

    if (visit.status === 'CANCELLED') {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: '访视已取消' },
      });
    }

    if (ENDED_OR_LATER.includes(visit.status)) {
      await logAudit({
        type: 'VISIT_ENDED_IDEMPOTENT',
        userId: user.id,
        entityType: 'MonitoringVisit',
        entityId: id,
        payload: { status: visit.status },
      });
      return {
        visit: {
          id: visit.id,
          status: visit.status,
          actualStartTime: visit.actualStartTime?.toISOString(),
          actualEndTime: visit.actualEndTime?.toISOString(),
        },
        idempotent: true,
        actionPackId: visit.actionPacks[0]?.id ?? null,
      };
    }

    const endTime = body.data.actualEndTime
      ? new Date(body.data.actualEndTime)
      : new Date();

    const updated = await prisma.monitoringVisit.update({
      where: { id },
      data: {
        status: 'PENDING_WRAP_UP',
        actualEndTime: endTime,
      },
    });

    await logAudit({
      type: 'VISIT_ENDED',
      userId: user.id,
      entityType: 'MonitoringVisit',
      entityId: id,
      payload: { actualEndTime: endTime.toISOString() },
    });

    return {
      visit: {
        id: updated.id,
        status: updated.status,
        actualStartTime: updated.actualStartTime?.toISOString(),
        actualEndTime: updated.actualEndTime?.toISOString(),
      },
      idempotent: false,
      actionPackId: null,
    };
  });

  /** End visit + generate/reuse single action pack (preferred client path) */
  app.post('/:id/complete', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };
    const body = completeSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: '参数无效' } });
    }

    const visit = await prisma.monitoringVisit.findUnique({ where: { id } });
    if (!visit) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '访视不存在' } });
    }

    const hasAccess = await userHasProjectAccess(user.id, visit.projectId, visit.siteId);
    if (!hasAccess) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: '无权限' } });
    }

    try {
      const result = await completeVisit(id, user.id, body.data.actualEndTime);
      const pack = await prisma.actionPack.findUnique({
        where: { id: result.actionPackId },
        include: { items: true },
      });

      return {
        visit: {
          id: result.visit.id,
          status: result.visit.status,
          actualStartTime: result.visit.actualStartTime?.toISOString() ?? null,
          actualEndTime: result.visit.actualEndTime?.toISOString() ?? null,
        },
        actionPack: pack
          ? {
              id: pack.id,
              status: pack.status,
              monitoringVisitId: pack.monitoringVisitId,
              itemCount: pack.items.length,
              summary: pack.summary ? JSON.parse(pack.summary) : null,
              warnings: pack.warnings ? JSON.parse(pack.warnings) : [],
              followUpQuestions: pack.followUpQuestions
                ? JSON.parse(pack.followUpQuestions)
                : [],
              modelInfo: pack.modelInfo ? JSON.parse(pack.modelInfo) : null,
              items: pack.items.map((item) => ({
                id: item.id,
                type: item.type,
                title: item.title,
                description: item.description,
                data: JSON.parse(item.data),
                status: item.status,
                origin: item.origin,
                sources: item.sourceIds ? JSON.parse(item.sourceIds) : null,
                requiresIndividualConfirm: item.requiresIndividualConfirm,
                blockingReason: item.blockingReason,
              })),
            }
          : null,
        idempotent: result.idempotent,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : '结束访视失败';
      const code = message.includes('尚未开始') ? 'INVALID_STATUS' : 'COMPLETE_FAILED';
      return reply.status(400).send({ error: { code, message } });
    }
  });

  /** Adjust visit times/summary during wrap-up confirmation */
  app.patch('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };
    const body = patchVisitSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: '参数无效' } });
    }

    const visit = await prisma.monitoringVisit.findUnique({ where: { id } });
    if (!visit) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '访视不存在' } });
    }

    if (['PENDING_PM_REVIEW', 'PENDING_QA_REVIEW', 'APPROVED', 'CANCELLED'].includes(visit.status)) {
      return reply.status(400).send({
        error: { code: 'LOCKED', message: '当前状态不可修改访视时间' },
      });
    }

    const updated = await prisma.monitoringVisit.update({
      where: { id },
      data: {
        actualStartTime: body.data.actualStartTime
          ? new Date(body.data.actualStartTime)
          : undefined,
        actualEndTime: body.data.actualEndTime
          ? new Date(body.data.actualEndTime)
          : undefined,
        workSummary: body.data.workSummary ?? undefined,
      },
    });

    await logAudit({
      type: 'VISIT_ENDED',
      userId: user.id,
      entityType: 'MonitoringVisit',
      entityId: id,
      payload: {
        action: 'times_adjusted',
        actualStartTime: updated.actualStartTime?.toISOString(),
        actualEndTime: updated.actualEndTime?.toISOString(),
      },
    });

    const durationMinutes =
      updated.actualStartTime && updated.actualEndTime
        ? Math.round(
            (updated.actualEndTime.getTime() - updated.actualStartTime.getTime()) / 60000,
          )
        : null;

    return {
      visit: {
        id: updated.id,
        status: updated.status,
        actualStartTime: updated.actualStartTime?.toISOString() ?? null,
        actualEndTime: updated.actualEndTime?.toISOString() ?? null,
        durationMinutes,
        workSummary: updated.workSummary,
      },
    };
  });

  app.post('/:id/inputs', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };
    const body = inputSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: '参数无效' } });
    }

    const visit = await prisma.monitoringVisit.findUnique({ where: { id } });
    if (!visit) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '访视不存在' } });
    }

    if (!['IN_PROGRESS', 'PENDING_WRAP_UP', 'PLANNED', 'PM_RETURNED'].includes(visit.status)) {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: '当前状态无法接受输入' },
      });
    }

    // Idempotent client input
    if (body.data.clientInputId) {
      const existing = await prisma.visitInput.findFirst({
        where: { clientInputId: body.data.clientInputId, userId: user.id },
      });
      if (existing) {
        return { input: existing, idempotent: true };
      }
    }

    const input = await prisma.visitInput.create({
      data: {
        monitoringVisitId: id,
        userId: user.id,
        type: body.data.type,
        content: body.data.content,
        transcript: body.data.transcript,
        clientInputId: body.data.clientInputId,
        originalContent: body.data.content,
        syncStatus: 'SYNCED',
      },
    });

    await logAudit({
      type: 'INPUT_CREATED',
      userId: user.id,
      entityType: 'VisitInput',
      entityId: input.id,
      payload: { visitId: id, type: body.data.type },
    });

    return { input, idempotent: false };
  });

  app.patch('/:id/inputs/:inputId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { id, inputId } = request.params as { id: string; inputId: string };
    const body = updateInputSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: body.error.errors[0]?.message ?? '参数无效',
        },
      });
    }

    const visit = await prisma.monitoringVisit.findUnique({ where: { id } });
    if (!visit) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '访视不存在' } });
    }

    if (['PENDING_PM_REVIEW', 'PENDING_QA_REVIEW', 'APPROVED'].includes(visit.status)) {
      return reply.status(400).send({
        error: {
          code: 'LOCKED',
          message: '访视已提交审核，无法直接修改记录；请等待退回或走更正流程',
        },
      });
    }

    const input = await prisma.visitInput.findFirst({
      where: { id: inputId, monitoringVisitId: id },
    });
    if (!input || input.isVoided) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '工作记录不存在或已作废' } });
    }

    const previousContent = input.content;
    const updated = await prisma.visitInput.update({
      where: { id: inputId },
      data: {
        content: body.data.content,
        transcript: body.data.transcript ?? input.transcript,
        originalContent: input.originalContent ?? previousContent,
        editReason: body.data.reason,
        version: input.version + 1,
        status: 'EDITED',
      },
    });

    await logAudit({
      type: 'INPUT_EDITED',
      userId: user.id,
      entityType: 'VisitInput',
      entityId: inputId,
      payload: {
        visitId: id,
        reason: body.data.reason,
        previousContent,
        newContent: body.data.content,
        version: updated.version,
      },
    });

    return { input: updated };
  });

  app.post('/:id/inputs/:inputId/void', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { id, inputId } = request.params as { id: string; inputId: string };
    const body = voidInputSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: body.error.errors[0]?.message ?? '参数无效',
        },
      });
    }

    const visit = await prisma.monitoringVisit.findUnique({ where: { id } });
    if (!visit) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '访视不存在' } });
    }

    if (['PENDING_PM_REVIEW', 'PENDING_QA_REVIEW', 'APPROVED'].includes(visit.status)) {
      return reply.status(400).send({
        error: {
          code: 'LOCKED',
          message: '访视已提交审核，无法作废记录',
        },
      });
    }

    const input = await prisma.visitInput.findFirst({
      where: { id: inputId, monitoringVisitId: id },
    });
    if (!input) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '工作记录不存在' } });
    }
    if (input.isVoided) {
      return { input, idempotent: true };
    }

    const updated = await prisma.visitInput.update({
      where: { id: inputId },
      data: {
        isVoided: true,
        voidedAt: new Date(),
        voidReason: body.data.reason,
        voidedById: user.id,
        status: 'VOIDED',
      },
    });

    await logAudit({
      type: 'INPUT_VOIDED',
      userId: user.id,
      entityType: 'VisitInput',
      entityId: inputId,
      payload: {
        visitId: id,
        reason: body.data.reason,
        originalContent: input.content,
      },
    });

    return { input: updated, idempotent: false };
  });

  app.get('/:id/inputs', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const { includeVoided } = request.query as { includeVoided?: string };
    const inputs = await prisma.visitInput.findMany({
      where: {
        monitoringVisitId: id,
        ...(includeVoided === 'true' ? {} : { isVoided: false }),
      },
      orderBy: { createdAt: 'asc' },
    });
    return { inputs };
  });

  app.get('/:id/activities', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const visit = await prisma.monitoringVisit.findUnique({ where: { id } });
    if (!visit) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '访视不存在' } });
    }

    await ensureVisitActivities(id, visit.type);
    const activities = await prisma.visitActivity.findMany({
      where: { monitoringVisitId: id },
      orderBy: { sortOrder: 'asc' },
    });

    return {
      activities: activities.map((a) => ({
        id: a.id,
        activityType: a.activityType,
        title: a.title,
        status: a.status,
        note: a.note,
        sortOrder: a.sortOrder,
        relatedIssueIds: a.relatedIssueIds ? JSON.parse(a.relatedIssueIds) : [],
        evidenceIds: a.evidenceIds ? JSON.parse(a.evidenceIds) : [],
        sourceInputId: a.sourceInputId,
      })),
    };
  });

  app.patch('/:id/activities/:activityId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { id, activityId } = request.params as { id: string; activityId: string };
    const body = activityUpdateSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: '参数无效' } });
    }

    const activity = await prisma.visitActivity.findFirst({
      where: { id: activityId, monitoringVisitId: id },
    });
    if (!activity) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '访视活动不存在' } });
    }

    const updated = await prisma.visitActivity.update({
      where: { id: activityId },
      data: {
        status: body.data.status ?? activity.status,
        note: body.data.note !== undefined ? body.data.note : activity.note,
        relatedIssueIds:
          body.data.relatedIssueIds !== undefined
            ? JSON.stringify(body.data.relatedIssueIds)
            : activity.relatedIssueIds,
        evidenceIds:
          body.data.evidenceIds !== undefined
            ? JSON.stringify(body.data.evidenceIds)
            : activity.evidenceIds,
      },
    });

    await logAudit({
      type: 'ACTIVITY_UPDATED',
      userId: user.id,
      entityType: 'VisitActivity',
      entityId: activityId,
      payload: { visitId: id, status: updated.status, note: updated.note },
    });

    return {
      activity: {
        ...updated,
        relatedIssueIds: updated.relatedIssueIds ? JSON.parse(updated.relatedIssueIds) : [],
        evidenceIds: updated.evidenceIds ? JSON.parse(updated.evidenceIds) : [],
      },
    };
  });
}
