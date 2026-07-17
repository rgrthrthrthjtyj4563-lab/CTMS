import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthUser } from '../lib/auth.js';
import { prisma } from '../db.js';
import {
  createActionPackFromAi,
  confirmActionItem,
  confirmAllEligibleItems,
  submitActionPack,
} from '../lib/action-pack.js';
import { logAudit } from '../lib/audit.js';

const editSchema = z.object({
  data: z.record(z.unknown()),
  title: z.string().optional(),
  description: z.string().optional(),
});

export async function actionPackRoutes(app: FastifyInstance) {
  app.post('/generate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { visitId } = request.body as { visitId: string };

    if (!visitId) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'visitId 必填' } });
    }

    const visit = await prisma.monitoringVisit.findUnique({ where: { id: visitId } });
    if (!visit) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '访视不存在' } });
    }

    try {
      const result = await createActionPackFromAi(visitId, user.id);
      const pack = await prisma.actionPack.findUnique({
        where: { id: result.packId },
        include: { items: true },
      });

      return {
        actionPack: formatPack(pack!),
        generated: result.generated,
        idempotent: result.idempotent,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成失败';
      return reply.status(500).send({ error: { code: 'GENERATION_FAILED', message } });
    }
  });

  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pack = await prisma.actionPack.findUnique({
      where: { id },
      include: { items: true, monitoringVisit: { include: { project: true, site: true } } },
    });

    if (!pack) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '动作包不存在' } });
    }

    return { actionPack: formatPack(pack) };
  });

  app.get('/visit/:visitId', { preHandler: [app.authenticate] }, async (request) => {
    const { visitId } = request.params as { visitId: string };
    const packs = await prisma.actionPack.findMany({
      where: { monitoringVisitId: visitId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return { actionPacks: packs.map(formatPack) };
  });

  app.post('/:id/items/:itemId/confirm', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { itemId } = request.params as { id: string; itemId: string };
    const body = request.body as { data?: Record<string, unknown> } | undefined;

    try {
      const result = await confirmActionItem(itemId, user.id, body?.data);
      return { confirmed: true, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : '确认失败';
      return reply.status(400).send({ error: { code: 'CONFIRM_FAILED', message } });
    }
  });

  app.patch('/:id/items/:itemId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { itemId } = request.params as { itemId: string };
    const body = editSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: '参数无效' } });
    }

    const item = await prisma.actionItem.update({
      where: { id: itemId },
      data: {
        data: JSON.stringify(body.data.data),
        title: body.data.title,
        description: body.data.description,
        status: 'EDITED',
      },
    });

    await logAudit({
      type: 'ACTION_EDITED',
      userId: user.id,
      entityType: 'ActionItem',
      entityId: itemId,
    });

    return { item: formatItem(item) };
  });

  app.delete('/:id/items/:itemId', { preHandler: [app.authenticate] }, async (request, _reply) => {
    const user = request.user as AuthUser;
    const { itemId } = request.params as { itemId: string };

    await prisma.actionItem.update({
      where: { id: itemId },
      data: { status: 'DELETED' },
    });

    await logAudit({
      type: 'ACTION_DELETED',
      userId: user.id,
      entityType: 'ActionItem',
      entityId: itemId,
    });

    return { deleted: true };
  });

  app.post('/:id/confirm-batch', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };
    const result = await confirmAllEligibleItems(id, user.id);
    return result;
  });

  app.post('/:id/submit', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };

    try {
      const pack = await submitActionPack(id, user.id);
      return { submitted: true, actionPack: formatPack(pack as unknown as Parameters<typeof formatPack>[0]) };
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交失败';
      return reply.status(400).send({ error: { code: 'SUBMIT_FAILED', message } });
    }
  });
}

function formatPack(pack: {
  id: string;
  monitoringVisitId: string;
  userId: string;
  status: string;
  summary: string | null;
  warnings: string | null;
  followUpQuestions: string | null;
  modelInfo?: string | null;
  isActive?: boolean;
  submittedAt: Date | null;
  createdAt: Date;
  items?: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    data: string;
    status: string;
    sourceIds: string | null;
    origin?: string;
    requiresIndividualConfirm: boolean;
    blockingReason: string | null;
    confirmedAt: Date | null;
    savedEntityId: string | null;
  }>;
  monitoringVisit?: { project: { name: string; code: string }; site: { name: string } };
}) {
  return {
    id: pack.id,
    monitoringVisitId: pack.monitoringVisitId,
    status: pack.status,
    summary: pack.summary ? JSON.parse(pack.summary) : null,
    warnings: pack.warnings ? JSON.parse(pack.warnings) : [],
    followUpQuestions: pack.followUpQuestions ? JSON.parse(pack.followUpQuestions) : [],
    modelInfo: pack.modelInfo ? JSON.parse(pack.modelInfo) : null,
    isActive: pack.isActive ?? true,
    submittedAt: pack.submittedAt?.toISOString(),
    createdAt: pack.createdAt.toISOString(),
    items: pack.items?.map(formatItem) ?? [],
  };
}

function formatItem(item: {
  id: string;
  type: string;
  title: string;
  description: string | null;
  data: string;
  status: string;
  sourceIds: string | null;
  origin?: string;
  requiresIndividualConfirm: boolean;
  blockingReason: string | null;
  confirmedAt: Date | null;
  savedEntityId: string | null;
}) {
  const parsedSources = item.sourceIds ? JSON.parse(item.sourceIds) : null;
  const origin =
    item.origin ||
    (parsedSources && typeof parsedSources === 'object' && 'origin' in parsedSources
      ? (parsedSources as { origin?: string }).origin
      : 'RULE');

  return {
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    data: JSON.parse(item.data),
    status: item.status,
    origin,
    sources: parsedSources,
    requiresIndividualConfirm: item.requiresIndividualConfirm,
    blockingReason: item.blockingReason,
    confirmedAt: item.confirmedAt?.toISOString(),
    savedEntityId: item.savedEntityId,
  };
}
