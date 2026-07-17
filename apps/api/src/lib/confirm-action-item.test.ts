/**
 * Integration tests: confirmActionItem must not throw on invalid LLM date/shape fields.
 * Uses seeded CRA/project/site from test-setup (test.db).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../db.js';
import { confirmActionItem } from './action-pack.js';

describe('confirmActionItem — dirty LLM fields', () => {
  let userId: string;
  let projectId: string;
  let siteId: string;
  let packId: string;
  let visitId: string;
  const plannedDate = new Date('2026-07-15T00:00:00.000Z');
  const actualStart = new Date('2026-07-15T01:10:00.000Z'); // 09:10 +8

  beforeAll(async () => {
    const cra = await prisma.user.findUnique({ where: { phone: '13800138001' } });
    const project = await prisma.project.findFirst({ where: { code: 'AJ-001' } });
    const site = await prisma.site.findFirst({ where: { projectId: project!.id } });
    expect(cra).toBeTruthy();
    expect(project).toBeTruthy();
    expect(site).toBeTruthy();
    userId = cra!.id;
    projectId = project!.id;
    siteId = site!.id;

    const visit = await prisma.monitoringVisit.create({
      data: {
        projectId,
        siteId,
        craId: userId,
        type: 'IMV',
        status: 'PENDING_WRAP_UP',
        plannedDate,
        actualStartTime: actualStart,
        actualEndTime: new Date('2026-07-15T09:40:00.000Z'),
      },
    });
    visitId = visit.id;

    const pack = await prisma.actionPack.create({
      data: {
        monitoringVisitId: visitId,
        userId,
        status: 'PENDING_CONFIRM',
        isActive: true,
        items: {
          create: [
            {
              type: 'TASK',
              title: '补齐 03 号签字',
              description: '跟进签字',
              data: JSON.stringify({ title: '补齐 03 号签字', dueDate: '补齐' }),
              status: 'PENDING_CONFIRM',
              origin: 'MODEL',
            },
            {
              type: 'HOURS',
              title: '工时',
              data: JSON.stringify({
                date: '不是日期',
                durationHours: 8.5,
                workType: 'ON_SITE_MONITORING',
                description: 'IMV',
              }),
              status: 'PENDING_CONFIRM',
              origin: 'MODEL',
            },
            {
              type: 'ISSUE',
              title: '原始记录未签字',
              data: JSON.stringify({
                title: '原始记录未签字',
                description: '03 号缺签字',
                severity: 'Major',
                responsiblePerson: 'CRC小王',
                targetDate: '补齐',
              }),
              status: 'PENDING_CONFIRM',
              origin: 'MODEL',
            },
            {
              type: 'FOLLOW_UP_ITEM',
              title: '随访项',
              data: JSON.stringify({ dueDate: '下周某天' }),
              status: 'PENDING_CONFIRM',
              origin: 'MODEL',
            },
            {
              type: 'REPORT_DRAFT',
              title: '报告草稿',
              description: '访视说明占位',
              data: JSON.stringify({ sections: 'not-an-array' }),
              status: 'PENDING_CONFIRM',
              origin: 'MODEL',
            },
          ],
        },
      },
      include: { items: true },
    });
    packId = pack.id;
  });

  afterAll(async () => {
    // Cascade cleans items; leave rest of seed intact
    if (visitId) {
      await prisma.monitoringVisit.delete({ where: { id: visitId } }).catch(() => undefined);
    }
  });

  it('TASK: invalid dueDate → confirm OK, dueDate null, sourceId=packId, FALLBACK audit', async () => {
    const item = await prisma.actionItem.findFirst({
      where: { actionPackId: packId, type: 'TASK' },
    });
    expect(item).toBeTruthy();

    const result = await confirmActionItem(item!.id, userId);
    expect(result.type).toBe('TASK');
    expect(result.entityId).toBeTruthy();

    const todo = await prisma.todo.findUnique({ where: { id: result.entityId! } });
    expect(todo).toBeTruthy();
    expect(todo!.dueDate).toBeNull();
    expect(todo!.sourceType).toBe('TASK');
    expect(todo!.sourceId).toBe(packId);
    expect(todo!.group).toBe('NOW');

    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: item!.id, type: 'ACTION_CONFIRMED_FALLBACK' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
    const payload = JSON.parse(audit!.payload || '{}') as { fallbackFields?: string[] };
    expect(payload.fallbackFields).toContain('dueDate');
  });

  it('HOURS: invalid date → confirm OK, falls back to actualStart/plannedDate', async () => {
    const item = await prisma.actionItem.findFirst({
      where: { actionPackId: packId, type: 'HOURS' },
    });
    const result = await confirmActionItem(item!.id, userId);
    expect(result.type).toBe('HOURS');

    const hours = await prisma.hoursRecord.findUnique({ where: { id: result.entityId! } });
    expect(hours).toBeTruthy();
    expect(hours!.durationHours).toBe(8.5);
    // Prefer actualStartTime over plannedDate when data.date is garbage
    expect(hours!.date.getTime()).toBe(actualStart.getTime());

    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: item!.id, type: 'ACTION_CONFIRMED_FALLBACK' },
    });
    expect(audit).toBeTruthy();
  });

  it('ISSUE: invalid targetDate → confirm OK, no follow-up todo, targetDate null', async () => {
    const item = await prisma.actionItem.findFirst({
      where: { actionPackId: packId, type: 'ISSUE' },
    });
    const todosBefore = await prisma.todo.count({
      where: { sourceType: 'ISSUE', monitoringVisitId: visitId },
    });

    const result = await confirmActionItem(item!.id, userId);
    expect(result.type).toBe('ISSUE');

    const issue = await prisma.issue.findUnique({ where: { id: result.entityId! } });
    expect(issue).toBeTruthy();
    expect(issue!.targetDate).toBeNull();
    expect(issue!.responsiblePerson).toBe('CRC小王');
    expect(issue!.severity).toBe('HIGH');

    const todosAfter = await prisma.todo.count({
      where: { sourceType: 'ISSUE', monitoringVisitId: visitId },
    });
    expect(todosAfter).toBe(todosBefore);

    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: item!.id, type: 'ACTION_CONFIRMED_FALLBACK' },
    });
    expect(audit).toBeTruthy();
  });

  it('FOLLOW_UP_ITEM: invalid dueDate → today+7 placeholder, item/person fallbacks', async () => {
    const item = await prisma.actionItem.findFirst({
      where: { actionPackId: packId, type: 'FOLLOW_UP_ITEM' },
    });
    const before = Date.now();
    const result = await confirmActionItem(item!.id, userId);
    expect(result.type).toBe('FOLLOW_UP_ITEM');

    const fu = await prisma.followUpItem.findUnique({ where: { id: result.entityId! } });
    expect(fu).toBeTruthy();
    expect(fu!.item).toBe(item!.title);
    expect(fu!.responsiblePerson).toBe('（待指定）');
    const dueMs = fu!.dueDate.getTime();
    // ~7 days from now (±2 days for test slack)
    expect(dueMs).toBeGreaterThan(before + 5 * 86400000);
    expect(dueMs).toBeLessThan(before + 9 * 86400000);

    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: item!.id, type: 'ACTION_CONFIRMED_FALLBACK' },
    });
    expect(audit).toBeTruthy();
    const payload = JSON.parse(audit!.payload || '{}') as { fallbackFields?: string[] };
    expect(payload.fallbackFields).toEqual(
      expect.arrayContaining(['dueDate', 'item', 'responsiblePerson']),
    );
  });

  it('REPORT_DRAFT: missing sections → single summary placeholder section', async () => {
    const item = await prisma.actionItem.findFirst({
      where: { actionPackId: packId, type: 'REPORT_DRAFT' },
    });
    const result = await confirmActionItem(item!.id, userId);
    expect(result.type).toBe('REPORT_DRAFT');

    const draft = await prisma.reportDraft.findUnique({ where: { monitoringVisitId: visitId } });
    expect(draft).toBeTruthy();
    expect(draft!.title).toBeTruthy();
    const sections = JSON.parse(draft!.sections) as Array<{ sectionKey: string; content: string }>;
    expect(sections).toHaveLength(1);
    expect(sections[0].sectionKey).toBe('summary');
    expect(sections[0].content).toContain('访视说明占位');

    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: item!.id, type: 'ACTION_CONFIRMED_FALLBACK' },
    });
    expect(audit).toBeTruthy();
  });

  it('valid dates produce ACTION_CONFIRMED without fallback', async () => {
    const pack = await prisma.actionPack.create({
      data: {
        monitoringVisitId: visitId,
        userId,
        status: 'PENDING_CONFIRM',
        isActive: false,
        items: {
          create: [
            {
              type: 'TASK',
              title: '合法截止日期任务',
              data: JSON.stringify({
                title: '合法截止日期任务',
                dueDate: '2026-08-01T00:00:00.000Z',
              }),
              status: 'PENDING_CONFIRM',
              origin: 'RULE',
            },
          ],
        },
      },
      include: { items: true },
    });
    const item = pack.items[0];
    await confirmActionItem(item.id, userId);

    const ok = await prisma.auditEvent.findFirst({
      where: { entityId: item.id, type: 'ACTION_CONFIRMED' },
    });
    const fb = await prisma.auditEvent.findFirst({
      where: { entityId: item.id, type: 'ACTION_CONFIRMED_FALLBACK' },
    });
    expect(ok).toBeTruthy();
    expect(fb).toBeNull();

    const todo = await prisma.todo.findFirst({
      where: { sourceType: 'TASK', sourceId: pack.id, title: '合法截止日期任务' },
    });
    expect(todo?.dueDate?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });
});
