import type { FastifyInstance } from 'fastify';
import { getAuditTrail } from '../lib/audit.js';
import { prisma } from '../db.js';

export async function auditRoutes(app: FastifyInstance) {
  app.get('/:entityType/:entityId', { preHandler: [app.authenticate] }, async (request) => {
    const { entityType, entityId } = request.params as {
      entityType: string;
      entityId: string;
    };

    const trail = await getAuditTrail(entityType, entityId);
    return { auditTrail: trail };
  });

  app.get('/visit/:visitId/full', { preHandler: [app.authenticate] }, async (request) => {
    const { visitId } = request.params as { visitId: string };

    const visitEvents = await getAuditTrail('MonitoringVisit', visitId);

    const inputs = await prisma.visitInput.findMany({
      where: { monitoringVisitId: visitId },
    });

    const inputEvents = await Promise.all(
      inputs.map((i) => getAuditTrail('VisitInput', i.id)),
    );

    const packs = await prisma.actionPack.findMany({
      where: { monitoringVisitId: visitId },
    });

    const packEvents = await Promise.all(
      packs.map((p) => getAuditTrail('ActionPack', p.id)),
    );

    return {
      visitId,
      events: [
        ...visitEvents,
        ...inputEvents.flat(),
        ...packEvents.flat(),
      ].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    };
  });
}