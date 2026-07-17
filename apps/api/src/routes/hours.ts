import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthUser } from '../lib/auth.js';
import { prisma } from '../db.js';

const createSchema = z.object({
  projectId: z.string(),
  siteId: z.string().optional(),
  monitoringVisitId: z.string().optional(),
  date: z.string(),
  workType: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationHours: z.number().positive(),
  description: z.string(),
});

export async function hoursRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as AuthUser;
    const { date, status, month, page, pageSize } = request.query as {
      date?: string;
      status?: string;
      month?: string; // YYYY-MM
      page?: string;
      pageSize?: string;
    };

    const take = Math.min(parseInt(pageSize || '100', 10) || 100, 200);
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const skip = (pageNum - 1) * take;

    let dateFilter: { gte?: Date; lt?: Date } | undefined;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      dateFilter = {
        gte: new Date(Date.UTC(y, m - 1, 1)),
        lt: new Date(Date.UTC(y, m, 1)),
      };
    } else if (date) {
      dateFilter = {
        gte: new Date(date),
        lt: new Date(new Date(date).getTime() + 86400000),
      };
    }

    const where = {
      userId: user.id,
      ...(status ? { status } : {}),
      ...(dateFilter ? { date: dateFilter } : {}),
    };

    const [records, totalCount] = await Promise.all([
      prisma.hoursRecord.findMany({
        where,
        include: {
          project: { select: { code: true, name: true } },
          site: { select: { name: true } },
          monitoringVisit: { select: { id: true, type: true } },
        },
        orderBy: { date: 'desc' },
        take,
        skip,
      }),
      prisma.hoursRecord.count({ where }),
    ]);

    const totalHours = records.reduce((sum, r) => sum + r.durationHours, 0);

    return {
      records: records.map((r) => ({
        id: r.id,
        date: r.date.toISOString().split('T')[0],
        workType: r.workType,
        startTime: r.startTime,
        endTime: r.endTime,
        durationHours: r.durationHours,
        description: r.description,
        status: r.status,
        project: r.project,
        site: r.site,
        monitoringVisit: r.monitoringVisit,
      })),
      summary: {
        totalHours,
        recordCount: records.length,
        totalCount,
        pendingConfirm: records.filter((r) => r.status === 'DRAFT_CANDIDATE').length,
        month: month ?? null,
        page: pageNum,
        pageSize: take,
      },
    };
  });

  app.get('/conflicts', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as AuthUser;
    const { date } = request.query as { date: string };

    if (!date) {
      return { conflicts: [], message: '请提供 date 参数' };
    }

    const dayStart = new Date(date);
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    const records = await prisma.hoursRecord.findMany({
      where: {
        userId: user.id,
        date: { gte: dayStart, lt: dayEnd },
        status: { not: 'RETURNED' },
      },
      include: { project: true },
    });

    const conflicts: Array<{
      recordA: { id: string; startTime?: string | null; endTime?: string | null; project: string };
      recordB: { id: string; startTime?: string | null; endTime?: string | null; project: string };
      reason: string;
    }> = [];

    for (let i = 0; i < records.length; i++) {
      for (let j = i + 1; j < records.length; j++) {
        const a = records[i];
        const b = records[j];
        if (a.startTime && a.endTime && b.startTime && b.endTime) {
          if (timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
            conflicts.push({
              recordA: {
                id: a.id,
                startTime: a.startTime,
                endTime: a.endTime,
                project: a.project.code,
              },
              recordB: {
                id: b.id,
                startTime: b.startTime,
                endTime: b.endTime,
                project: b.project.code,
              },
              reason: '时间段重叠',
            });
          }
        }
      }
    }

    const totalHours = records.reduce((sum, r) => sum + r.durationHours, 0);
    const warnings: string[] = [];
    if (totalHours > 12) {
      warnings.push(`当日总工时 ${totalHours} 小时，请确认是否合理`);
    }

    return { conflicts, warnings, totalHours };
  });

  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const body = createSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: '参数无效' } });
    }

    const record = await prisma.hoursRecord.create({
      data: {
        userId: user.id,
        ...body.data,
        date: new Date(body.data.date),
        status: 'CRA_CONFIRMED',
      },
    });

    return { record };
  });

  app.post('/:id/confirm', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { id } = request.params as { id: string };

    const existing = await prisma.hoursRecord.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '工时记录不存在' } });
    }

    const record = await prisma.hoursRecord.update({
      where: { id },
      data: { status: 'CRA_CONFIRMED' },
    });

    return { record };
  });
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const a1 = toMinutes(aStart);
  const a2 = toMinutes(aEnd);
  const b1 = toMinutes(bStart);
  const b2 = toMinutes(bEnd);
  return a1 < b2 && b1 < a2;
}