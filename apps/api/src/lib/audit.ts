import type { AuditEventType } from '@clinical/domain';
import { prisma } from '../db.js';

export async function logAudit(params: {
  type: AuditEventType;
  userId?: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}) {
  return prisma.auditEvent.create({
    data: {
      type: params.type,
      userId: params.userId,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload ? JSON.stringify(params.payload) : null,
    },
  });
}

export async function getAuditTrail(entityType: string, entityId: string) {
  const events = await prisma.auditEvent.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  return events.map((e) => ({
    id: e.id,
    type: e.type,
    userId: e.userId,
    user: e.user,
    entityType: e.entityType,
    entityId: e.entityId,
    payload: e.payload ? JSON.parse(e.payload) : null,
    createdAt: e.createdAt.toISOString(),
  }));
}