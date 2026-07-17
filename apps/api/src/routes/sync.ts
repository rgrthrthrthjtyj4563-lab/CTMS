import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthUser } from '../lib/auth.js';
import { prisma } from '../db.js';
import { logAudit } from '../lib/audit.js';

const syncSchema = z.object({
  clientId: z.string(),
  lastSyncedAt: z.string().optional(),
  inputs: z
    .array(
      z.object({
        clientInputId: z.string(),
        monitoringVisitId: z.string(),
        type: z.enum(['TEXT', 'VOICE', 'IMAGE', 'FILE']),
        content: z.string(),
        createdAt: z.string(),
      }),
    )
    .optional(),
  drafts: z
    .array(
      z.object({
        entityType: z.string(),
        entityId: z.string().optional(),
        payload: z.record(z.unknown()),
      }),
    )
    .optional(),
});

export async function syncRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as AuthUser;
    const body = syncSchema.safeParse(request.body);
    if (!body.success) {
      return {
        status: 'FAILED',
        syncedInputs: 0,
        syncedAttachments: 0,
        errors: ['参数无效'],
      };
    }

    let syncedInputs = 0;
    const conflicts: Array<{
      entityType: string;
      entityId: string;
      serverVersion: Record<string, unknown>;
      clientVersion: Record<string, unknown>;
    }> = [];
    const errors: string[] = [];

    if (body.data.inputs) {
      for (const input of body.data.inputs) {
        const existing = await prisma.visitInput.findFirst({
          where: { clientInputId: input.clientInputId },
        });

        if (existing) {
          if (existing.content !== input.content) {
            conflicts.push({
              entityType: 'VisitInput',
              entityId: existing.id,
              serverVersion: { content: existing.content, updatedAt: existing.updatedAt },
              clientVersion: { content: input.content, createdAt: input.createdAt },
            });
          }
          continue;
        }

        const visit = await prisma.monitoringVisit.findUnique({
          where: { id: input.monitoringVisitId },
        });

        if (!visit) {
          errors.push(`访视 ${input.monitoringVisitId} 不存在`);
          continue;
        }

        await prisma.visitInput.create({
          data: {
            monitoringVisitId: input.monitoringVisitId,
            userId: user.id,
            type: input.type,
            content: input.content,
            clientInputId: input.clientInputId,
            syncStatus: 'SYNCED',
            createdAt: new Date(input.createdAt),
          },
        });
        syncedInputs++;
      }
    }

    if (body.data.drafts) {
      for (const draft of body.data.drafts) {
        await prisma.offlineDraft.upsert({
          where: {
            id: `${body.data.clientId}-${draft.entityType}-${draft.entityId || 'new'}`,
          },
          create: {
            id: `${body.data.clientId}-${draft.entityType}-${draft.entityId || 'new'}`,
            clientId: body.data.clientId,
            userId: user.id,
            entityType: draft.entityType,
            entityId: draft.entityId,
            payload: JSON.stringify(draft.payload),
            syncStatus: 'SYNCED',
          },
          update: {
            payload: JSON.stringify(draft.payload),
            syncStatus: 'SYNCED',
            updatedAt: new Date(),
          },
        });
      }
    }

    await logAudit({
      type: 'SYNC',
      userId: user.id,
      entityType: 'Sync',
      entityId: body.data.clientId,
      payload: { syncedInputs, conflictCount: conflicts.length },
    });

    return {
      status: conflicts.length > 0 ? 'CONFLICT' : errors.length > 0 ? 'FAILED' : 'SYNCED',
      syncedInputs,
      syncedAttachments: 0,
      conflicts: conflicts.length ? conflicts : undefined,
      errors: errors.length ? errors : undefined,
    };
  });

  app.get('/status', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as AuthUser;
    const { clientId } = request.query as { clientId?: string };

    const pendingDrafts = await prisma.offlineDraft.count({
      where: {
        userId: user.id,
        syncStatus: 'PENDING',
        ...(clientId ? { clientId } : {}),
      },
    });

    const pendingInputs = await prisma.visitInput.count({
      where: { userId: user.id, syncStatus: 'PENDING' },
    });

    return {
      pendingDrafts,
      pendingInputs,
      needsSync: pendingDrafts > 0 || pendingInputs > 0,
    };
  });

  app.get('/drafts', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as AuthUser;
    const drafts = await prisma.offlineDraft.findMany({
      where: { userId: user.id, syncStatus: { in: ['PENDING', 'SYNCED'] } },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      drafts: drafts.map((d) => ({
        id: d.id,
        clientId: d.clientId,
        entityType: d.entityType,
        entityId: d.entityId,
        payload: JSON.parse(d.payload),
        syncStatus: d.syncStatus,
        updatedAt: d.updatedAt.toISOString(),
      })),
    };
  });
}