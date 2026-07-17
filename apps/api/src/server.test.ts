import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './server.js';
import { prisma } from './db.js';

const ACCEPTANCE_INPUT =
  '今天在华山医院做了IMV，9:10到17:40。核对了12例受试者，发现03号受试者两份原始记录未签字，7月12日药物温度记录缺失。CRC小王承诺周五前补齐，PI下周一复核。我已经上传知情同意和药物管理文件照片。';

describe('AI Clinical Operations API - IMV workflow', () => {
  let app: FastifyInstance;
  let token: string;
  let pmToken: string;
  let visitId: string;
  let packId: string;
  let inputId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('health check returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
  });

  it('CRA can login with seed credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { phone: '13800138001', password: 'password' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeDefined();
    expect(body.user.name).toBe('李明');
    expect(body.user.role).toBe('CRA');
    token = body.token;
  });

  it('workbench shows today planned IMV', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/workbench',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.plannedVisits.length).toBeGreaterThanOrEqual(1);
    expect(body.plannedVisits[0].site.name).toBe('华山医院');
    expect(body.noVisitReason).toBeNull();
    expect(body.context.projectCode).toBe('AJ-001');
    visitId = body.plannedVisits[0].id;
  });

  it('reports no visit when context filters out today IMV', async () => {
    const cra = await prisma.user.findUnique({ where: { phone: '13800138001' } });
    const otherProject = await prisma.project.create({
      data: {
        code: 'TEST-EMPTY',
        name: 'Empty Context Test',
        organizationId: cra!.organizationId,
        status: 'ACTIVE',
      },
    });
    await prisma.userAssignment.create({
      data: {
        userId: cra!.id,
        projectId: otherProject.id,
        role: 'CRA',
      },
    });

    const ctxRes = await app.inject({
      method: 'PATCH',
      url: '/api/workbench/context',
      headers: { authorization: `Bearer ${token}` },
      payload: { projectId: otherProject.id },
    });
    expect(ctxRes.statusCode).toBe(200);

    const wbRes = await app.inject({
      method: 'GET',
      url: '/api/workbench',
      headers: { authorization: `Bearer ${token}` },
    });
    const wb = wbRes.json();
    expect(wb.plannedVisits.length).toBe(0);
    expect(wb.noVisitReason).toContain('无可用 IMV');

    const project = await prisma.project.findFirst({ where: { code: 'AJ-001' } });
    const site = await prisma.site.findFirst({ where: { projectId: project!.id } });
    await app.inject({
      method: 'PATCH',
      url: '/api/workbench/context',
      headers: { authorization: `Bearer ${token}` },
      payload: { projectId: project!.id, siteId: site!.id },
    });
  });

  it('starts IMV and accepts text input', async () => {
    const startRes = await app.inject({
      method: 'POST',
      url: `/api/monitoring-visits/${visitId}/start`,
      headers: { authorization: `Bearer ${token}` },
      payload: { actualStartTime: '2026-07-15T09:10:00.000Z' },
    });
    expect(startRes.statusCode).toBe(200);
    expect(startRes.json().visit.status).toBe('IN_PROGRESS');

    const inputRes = await app.inject({
      method: 'POST',
      url: `/api/monitoring-visits/${visitId}/inputs`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'TEXT', content: ACCEPTANCE_INPUT },
    });
    expect(inputRes.statusCode).toBe(200);
    inputId = inputRes.json().input.id;

    const wbRes = await app.inject({
      method: 'GET',
      url: '/api/workbench',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(wbRes.json().timeline.some((t: { id: string }) => t.id === inputId)).toBe(true);
  });

  it('voice transcribe rejects missing file and never returns fake transcript', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/voice/transcribe',
      headers: { authorization: `Bearer ${token}` },
      payload: 'not-multipart',
    });
    expect(res.statusCode).not.toBe(200);
    expect(JSON.stringify(res.json())).not.toContain('华山医院做了IMV');
  });

  it('ends IMV and generates action pack via complete (idempotent)', async () => {
    const completeRes = await app.inject({
      method: 'POST',
      url: `/api/monitoring-visits/${visitId}/complete`,
      headers: { authorization: `Bearer ${token}` },
      payload: { actualEndTime: '2026-07-15T17:40:00.000Z' },
    });
    expect(completeRes.statusCode).toBe(200);
    const body = completeRes.json();
    expect(body.visit.status).toBe('PENDING_WRAP_UP');
    expect(body.actionPack).toBeDefined();
    expect(body.idempotent).toBe(false);

    packId = body.actionPack.id;
    const items = body.actionPack.items;

    const hours = items.find((i: { type: string }) => i.type === 'HOURS');
    expect(hours.data.durationHours).toBe(8.5);

    const issues = items.filter((i: { type: string }) => i.type === 'ISSUE');
    expect(issues).toHaveLength(2);

    const mv = items.find((i: { type: string }) => i.type === 'MONITORING_VISIT_RECORD');
    expect(mv.data.subjectsReviewed).toBe(12);

    expect(items.some((i: { type: string }) => i.type === 'RISK_CANDIDATE')).toBe(true);
    expect(items.some((i: { type: string }) => i.type === 'CAPA_CANDIDATE')).toBe(true);
    expect(items.some((i: { type: string }) => i.type === 'REPORT_DRAFT')).toBe(true);
    expect(items.some((i: { type: string }) => i.type === 'FOLLOW_UP_ITEM')).toBe(true);
    expect(items.some((i: { type: string }) => i.type === 'TASK')).toBe(true);

    // Sources and origin present; DEMO_MODE must not claim MODEL when rules ran
    for (const item of items) {
      expect(item.origin).toBeTruthy();
      expect(item.sources).toBeTruthy();
    }
    if (process.env.DEMO_MODE === '1' || process.env.DEMO_MODE === 'true') {
      const modelInfo = body.actionPack.modelInfo as { origin?: string; model?: string } | null;
      expect(modelInfo?.origin).toBe('RULE');
      expect(modelInfo?.model).toMatch(/rules/);
      for (const item of items) {
        expect(item.origin).toBe('RULE');
      }
    }

    // Second complete is idempotent — same pack, no error
    const again = await app.inject({
      method: 'POST',
      url: `/api/monitoring-visits/${visitId}/complete`,
      headers: { authorization: `Bearer ${token}` },
      payload: { actualEndTime: '2026-07-15T17:40:00.000Z' },
    });
    expect(again.statusCode).toBe(200);
    expect(again.json().actionPack.id).toBe(packId);
    expect(again.json().idempotent).toBe(true);

    // generate also idempotent
    const genAgain = await app.inject({
      method: 'POST',
      url: '/api/action-packs/generate',
      headers: { authorization: `Bearer ${token}` },
      payload: { visitId },
    });
    expect(genAgain.statusCode).toBe(200);
    expect(genAgain.json().actionPack.id).toBe(packId);
    expect(genAgain.json().idempotent).toBe(true);

    // end endpoint also idempotent
    const endAgain = await app.inject({
      method: 'POST',
      url: `/api/monitoring-visits/${visitId}/end`,
      headers: { authorization: `Bearer ${token}` },
      payload: { actualEndTime: '2026-07-15T17:40:00.000Z' },
    });
    expect(endAgain.statusCode).toBe(200);
    expect(endAgain.json().idempotent).toBe(true);
  });

  it('supports hours month filter and todos with navigation href', async () => {
    const hoursRes = await app.inject({
      method: 'GET',
      url: '/api/hours?month=2026-07',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(hoursRes.statusCode).toBe(200);
    expect(hoursRes.json().summary.month).toBe('2026-07');

    const todoRes = await app.inject({
      method: 'GET',
      url: '/api/todos',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(todoRes.statusCode).toBe(200);
    // todos may be empty before submit; structure must include href field when present
    for (const t of todoRes.json().todos) {
      expect(t).toHaveProperty('href');
    }
  });

  it('patches visit end time during wrap-up', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/monitoring-visits/${visitId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actualEndTime: '2026-07-15T18:00:00.000Z',
        workSummary: '总结确认页调整后的工作摘要',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().visit.actualEndTime).toContain('2026-07-15');
    expect(res.json().visit.durationMinutes).toBeTypeOf('number');
  });

  it('seeds visit activities and supports edit/void input', async () => {
    const actRes = await app.inject({
      method: 'GET',
      url: `/api/monitoring-visits/${visitId}/activities`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(actRes.statusCode).toBe(200);
    const activities = actRes.json().activities;
    expect(activities.length).toBeGreaterThanOrEqual(4);

    const patchAct = await app.inject({
      method: 'PATCH',
      url: `/api/monitoring-visits/${visitId}/activities/${activities[0].id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'DONE', note: '已完成核对' },
    });
    expect(patchAct.statusCode).toBe(200);
    expect(patchAct.json().activity.status).toBe('DONE');

    // New input then edit + void (PM_RETURNED-like status not needed; wrap-up allows input)
    const inputRes = await app.inject({
      method: 'POST',
      url: `/api/monitoring-visits/${visitId}/inputs`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'TEXT', content: '补充说明：温度日志已拍照' },
    });
    expect(inputRes.statusCode).toBe(200);
    const newInputId = inputRes.json().input.id;

    const editRes = await app.inject({
      method: 'PATCH',
      url: `/api/monitoring-visits/${visitId}/inputs/${newInputId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { content: '补充说明：温度日志已拍照并归档', reason: '修正措辞' },
    });
    expect(editRes.statusCode).toBe(200);
    expect(editRes.json().input.version).toBe(2);

    const voidRes = await app.inject({
      method: 'POST',
      url: `/api/monitoring-visits/${visitId}/inputs/${newInputId}/void`,
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: '重复录入' },
    });
    expect(voidRes.statusCode).toBe(200);
    expect(voidRes.json().input.isVoided).toBe(true);
  });

  it('confirms all eligible items and submits to PM', async () => {
    const packRes = await app.inject({
      method: 'GET',
      url: `/api/action-packs/${packId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const items = packRes.json().actionPack.items;

    for (const item of items) {
      if (item.requiresIndividualConfirm) continue;
      const confirmRes = await app.inject({
        method: 'POST',
        url: `/api/action-packs/${packId}/items/${item.id}/confirm`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(confirmRes.statusCode).toBe(200);
    }

    for (const item of items.filter((i: { type: string }) =>
      ['RISK_CANDIDATE', 'CAPA_CANDIDATE'].includes(i.type),
    )) {
      const confirmRes = await app.inject({
        method: 'POST',
        url: `/api/action-packs/${packId}/items/${item.id}/confirm`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(confirmRes.statusCode).toBe(200);
    }

    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/action-packs/${packId}/submit`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(submitRes.statusCode).toBe(200);

    const visitRes = await app.inject({
      method: 'GET',
      url: `/api/monitoring-visits/${visitId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(visitRes.json().visit.status).toBe('PENDING_PM_REVIEW');
  });

  it('PM can approve the work package', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { phone: '13800138002', password: 'password' },
    });
    pmToken = loginRes.json().token;

    const reviewRes = await app.inject({
      method: 'POST',
      url: `/api/reviews/action-packs/${packId}`,
      headers: { authorization: `Bearer ${pmToken}` },
      payload: { decision: 'APPROVE', comment: '审核通过' },
    });
    expect(reviewRes.statusCode).toBe(200);
    expect(reviewRes.json().visitStatus).toBe('APPROVED');
  });

  it('PM can return a work package on a fresh visit', async () => {
    const cra = await prisma.user.findUnique({ where: { phone: '13800138001' } });
    const project = await prisma.project.findFirst({ where: { code: 'AJ-001' } });
    const site = await prisma.site.findFirst({ where: { projectId: project!.id } });

    const returnVisit = await prisma.monitoringVisit.create({
      data: {
        projectId: project!.id,
        siteId: site!.id,
        craId: cra!.id,
        type: 'IMV',
        status: 'PLANNED',
        plannedDate: new Date(),
      },
    });

    await app.inject({
      method: 'POST',
      url: `/api/monitoring-visits/${returnVisit.id}/start`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    await app.inject({
      method: 'POST',
      url: `/api/monitoring-visits/${returnVisit.id}/inputs`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'TEXT', content: ACCEPTANCE_INPUT },
    });
    await app.inject({
      method: 'POST',
      url: `/api/monitoring-visits/${returnVisit.id}/end`,
      headers: { authorization: `Bearer ${token}` },
      payload: { actualEndTime: new Date().toISOString() },
    });
    const gen = await app.inject({
      method: 'POST',
      url: '/api/action-packs/generate',
      headers: { authorization: `Bearer ${token}` },
      payload: { visitId: returnVisit.id },
    });
    const returnPackId = gen.json().actionPack.id;
    const packItems = gen.json().actionPack.items;

    for (const item of packItems) {
      await app.inject({
        method: 'POST',
        url: `/api/action-packs/${returnPackId}/items/${item.id}/confirm`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
    }
    await app.inject({
      method: 'POST',
      url: `/api/action-packs/${returnPackId}/submit`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    const returnRes = await app.inject({
      method: 'POST',
      url: `/api/reviews/action-packs/${returnPackId}`,
      headers: { authorization: `Bearer ${pmToken}` },
      payload: { decision: 'RETURN', comment: '请补充药物温度记录说明' },
    });
    expect(returnRes.statusCode).toBe(200);
    expect(returnRes.json().visitStatus).toBe('PM_RETURNED');

    // Subtitle on CRA workbench must surface the PM comment so a one-screen
    // demo can show "what was returned and why" without leaving home.
    const wb = await app.inject({
      method: 'GET',
      url: '/api/workbench',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(wb.statusCode).toBe(200);
    const returned = (wb.json().highlights as Array<{ type: string; subtitle?: string }>) ?? [];
    const ret = returned.find((h) => h.type === 'PM_RETURN');
    expect(ret).toBeDefined();
    expect(ret!.subtitle).toContain('请补充药物温度记录说明');
  });

  it('data persists after reload', async () => {
    const visitRes = await app.inject({
      method: 'GET',
      url: `/api/monitoring-visits/${visitId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(visitRes.json().visit.status).toBe('APPROVED');
    expect(
      visitRes.json().visit.inputs.some((i: { id: string }) => i.id === inputId),
    ).toBe(true);

    const packRes = await app.inject({
      method: 'GET',
      url: `/api/action-packs/${packId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(packRes.statusCode).toBe(200);
    expect(packRes.json().actionPack.items.length).toBeGreaterThan(0);
  });

  it('audit trail is preserved', async () => {
    const auditRes = await app.inject({
      method: 'GET',
      url: `/api/audit/visit/${visitId}/full`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(auditRes.statusCode).toBe(200);
    const events = auditRes.json().events;
    expect(events.length).toBeGreaterThan(0);
    const types = events.map((e: { type: string }) => e.type);
    expect(types).toContain('VISIT_STARTED');
    expect(types).toContain('INPUT_CREATED');
    expect(types).toContain('AI_GENERATED');
    expect(types).toContain('PACK_SUBMITTED');
    expect(types).toContain('PM_REVIEW');
  });

  it('hours endpoint shows 8.5h record', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/hours',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const records = res.json().records;
    const imvHours = records.find(
      (r: { durationHours: number; workType: string }) =>
        r.workType === 'ON_SITE_MONITORING' && r.durationHours === 8.5,
    );
    expect(imvHours).toBeDefined();
  });

  it('issues endpoint shows 2 confirmed issues', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/issues',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const issues = res.json().issues.filter((i: { monitoringVisitId: string }) =>
      i.monitoringVisitId === visitId,
    );
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});