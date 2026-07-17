import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthUser } from '../lib/auth.js';
import { prisma } from '../db.js';
import { getAuditTrail } from '../lib/audit.js';

const createSchema = z.object({
  projectId: z.string(),
  siteId: z.string(),
  monitoringVisitId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string(),
  severity: z.string(),
  subjectId: z.string().optional(),
  responsiblePerson: z.string().optional(),
  targetDate: z.string().optional(),
  requiredEvidence: z.string().optional(),
});

export async function issueRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as AuthUser;
    const { projectId, siteId, status } = request.query as {
      projectId?: string;
      siteId?: string;
      status?: string;
    };

    const assignments = await prisma.userAssignment.findMany({
      where: { userId: user.id },
      select: { projectId: true },
    });
    const projectIds = [...new Set(assignments.map((a) => a.projectId))];

    const issues = await prisma.issue.findMany({
      where: {
        projectId: projectId ? projectId : { in: projectIds },
        ...(siteId ? { siteId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        project: { select: { code: true, name: true } },
        site: { select: { name: true, code: true } },
        reporter: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      issues: issues.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        category: i.category,
        severity: i.severity,
        status: i.status,
        subjectId: i.subjectId,
        responsiblePerson: i.responsiblePerson,
        targetDate: i.targetDate?.toISOString(),
        requiredEvidence: i.requiredEvidence,
        project: i.project,
        site: i.site,
        reporter: i.reporter,
        monitoringVisitId: i.monitoringVisitId,
        createdAt: i.createdAt.toISOString(),
      })),
    };
  });

  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        project: true,
        site: true,
        reporter: { select: { id: true, name: true, role: true } },
        monitoringVisit: true,
      },
    });

    if (!issue) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Issue 不存在' } });
    }

    const auditTrail = await getAuditTrail('Issue', id);

    const attachments = issue.monitoringVisitId
      ? await prisma.attachment.findMany({
          where: { monitoringVisitId: issue.monitoringVisitId },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const capaItem = issue.monitoringVisitId
      ? await prisma.actionItem.findFirst({
          where: {
            type: 'CAPA_CANDIDATE',
            actionPack: { monitoringVisitId: issue.monitoringVisitId },
            data: { contains: issue.title.slice(0, 20) },
          },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    let capaCandidate = null;
    if (capaItem) {
      try {
        const parsed = JSON.parse(capaItem.data) as Record<string, string>;
        capaCandidate = {
          status: 'CANDIDATE' as const,
          corrective: parsed.corrective ?? capaItem.description ?? '',
          preventive: parsed.preventive ?? '',
          closeCondition: parsed.closeCondition ?? '',
        };
      } catch {
        capaCandidate = {
          status: 'CANDIDATE' as const,
          corrective: capaItem.description ?? '',
          preventive: '',
          closeCondition: '',
        };
      }
    }

    return {
      issue: {
        ...issue,
        targetDate: issue.targetDate?.toISOString(),
        createdAt: issue.createdAt.toISOString(),
      },
      attachments: attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sensitiveFlag: a.sensitiveFlag,
        createdAt: a.createdAt.toISOString(),
      })),
      capaCandidate,
      auditTrail,
    };
  });

  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const body = createSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: '参数无效' } });
    }

    const issue = await prisma.issue.create({
      data: {
        ...body.data,
        reporterId: user.id,
        targetDate: body.data.targetDate ? new Date(body.data.targetDate) : undefined,
        status: 'CRA_CONFIRMED',
      },
    });

    return { issue };
  });

  app.patch('/:id', { preHandler: [app.authenticate] }, async (request, _reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as Record<string, unknown>;

    const issue = await prisma.issue.update({
      where: { id },
      data: {
        ...(data.title ? { title: data.title as string } : {}),
        ...(data.description ? { description: data.description as string } : {}),
        ...(data.status ? { status: data.status as string } : {}),
        ...(data.responsiblePerson ? { responsiblePerson: data.responsiblePerson as string } : {}),
        ...(data.targetDate ? { targetDate: new Date(data.targetDate as string) } : {}),
      },
    });

    return { issue };
  });
}
