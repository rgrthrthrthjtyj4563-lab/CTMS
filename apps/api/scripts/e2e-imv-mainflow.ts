/**
 * IMV main-flow e2e (HTTP against a running API).
 *
 * Prerequisites:
 *   1. Seeded DB with CRA/PM and a usable project (pnpm db:seed or db:reset)
 *   2. API listening: cd apps/api && pnpm build && pnpm start
 *
 * This script always creates a fresh PLANNED IMV via Prisma so it does not
 * depend on leftover smoke state. It then drives:
 *   start → input → complete → confirm (incl. dirty LLM fields) → submit
 *   → PM todos/review → APPROVE → TASK href check → fallback audit check
 *
 * Exit: 0 pass | 1 assert fail | 2 API unavailable
 *
 * Usage:
 *   pnpm --filter @clinical/api test:e2e:imv
 *   API_BASE=http://localhost:3001 pnpm --filter @clinical/api test:e2e:imv
 */

import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
loadEnv({ path: path.join(apiRoot, '.env') });

const API_BASE = process.env.API_BASE ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const ACCEPTANCE_INPUT =
  '今天在华山医院做了IMV，9:10到17:40。核对了12例受试者，发现03号受试者两份原始记录未签字，7月12日药物温度记录缺失。CRC小王承诺周五前补齐，PI下周一复核。我已经上传知情同意和药物管理文件照片。';

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function ok(name: string) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name: string, detail: string): never {
  failed++;
  console.error(`  ✗ ${name}: ${detail}`);
  throw new Error(detail);
}

function assert(cond: boolean, name: string, detail?: string) {
  if (!cond) fail(name, detail ?? 'assertion failed');
  ok(name);
}

async function apiJson(
  p: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { token, ...rest } = init;
  const res = await fetch(`${API_BASE}${p}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

async function ensureFreshVisit(craId: string, projectId: string, siteId: string): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const visit = await prisma.monitoringVisit.create({
    data: {
      projectId,
      siteId,
      craId,
      type: 'IMV',
      status: 'PLANNED',
      plannedDate: today,
    },
  });
  return visit.id;
}

function asItems(body: Record<string, unknown>): Array<{
  id: string;
  type: string;
  title: string;
  data?: Record<string, unknown>;
  requiresIndividualConfirm?: boolean;
  status?: string;
}> {
  const pack = body.actionPack as { items?: Array<Record<string, unknown>> } | undefined;
  return (pack?.items ?? []) as Array<{
    id: string;
    type: string;
    title: string;
    data?: Record<string, unknown>;
    requiresIndividualConfirm?: boolean;
    status?: string;
  }>;
}

/** Dirty overrides that previously blocked confirm when left unvalidated. */
function dirtyOverride(type: string, base: Record<string, unknown> = {}): Record<string, unknown> {
  switch (type) {
    case 'TASK':
      return { ...base, dueDate: '补齐', title: (base.title as string) || '脏 dueDate 任务' };
    case 'HOURS':
      return {
        ...base,
        date: '不是日期',
        durationHours: typeof base.durationHours === 'number' ? base.durationHours : 8.5,
        workType: (base.workType as string) || 'ON_SITE_MONITORING',
        description: (base.description as string) || 'e2e dirty hours',
      };
    case 'ISSUE':
      return {
        ...base,
        title: (base.title as string) || '脏 targetDate issue',
        description: (base.description as string) || 'e2e',
        severity: (base.severity as string) || 'Major',
        responsiblePerson: (base.responsiblePerson as string) || 'CRC小王',
        targetDate: '补齐',
      };
    case 'FOLLOW_UP_ITEM':
      return { ...base, dueDate: '下周某天' };
    case 'REPORT_DRAFT':
      return { ...base, sections: 'not-an-array', title: '' };
    case 'MONITORING_VISIT_RECORD':
      return {
        ...base,
        actualStartTime: '坏时间',
        actualEndTime: '坏时间',
        workSummary: (base.workSummary as string) || 'e2e summary',
        subjectsReviewed: typeof base.subjectsReviewed === 'number' ? base.subjectsReviewed : 12,
      };
    default:
      return base;
  }
}

async function main() {
  console.log(`IMV e2e → ${API_BASE}`);

  // 0) Health
  let healthOk = false;
  try {
    const health = await apiJson('/api/health');
    healthOk = health.status === 200 && health.body.status === 'ok';
  } catch {
    healthOk = false;
  }
  if (!healthOk) {
    console.error('API unavailable. Start with: cd apps/api && pnpm build && pnpm start');
    console.error('Also ensure DB is seeded: pnpm --filter @clinical/api db:seed');
    process.exit(2);
  }
  ok('health');

  // 1) Login
  const craLogin = await apiJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: '13800138001', password: 'password' }),
  });
  assert(craLogin.status === 200, 'CRA login', `status ${craLogin.status}`);
  const craToken = craLogin.body.token as string;

  const pmLogin = await apiJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: '13800138002', password: 'password' }),
  });
  assert(pmLogin.status === 200, 'PM login', `status ${pmLogin.status}`);
  const pmToken = pmLogin.body.token as string;

  const cra = await prisma.user.findUnique({ where: { phone: '13800138001' } });
  const project = await prisma.project.findFirst({ where: { code: 'AJ-001' } });
  const site = await prisma.site.findFirst({ where: { projectId: project?.id } });
  assert(Boolean(cra && project && site), 'seed CRA/project/site present');

  // 2) Fresh visit (isolated from prior smoke runs)
  const visitId = await ensureFreshVisit(cra!.id, project!.id, site!.id);
  ok(`fresh visit ${visitId.slice(0, 8)}…`);

  // 3) start → input → complete
  const start = await apiJson(`/api/monitoring-visits/${visitId}/start`, {
    method: 'POST',
    token: craToken,
    body: JSON.stringify({ actualStartTime: '2026-07-15T09:10:00.000Z' }),
  });
  assert(start.status === 200, 'start visit', `status ${start.status}`);

  const input = await apiJson(`/api/monitoring-visits/${visitId}/inputs`, {
    method: 'POST',
    token: craToken,
    body: JSON.stringify({ type: 'TEXT', content: ACCEPTANCE_INPUT }),
  });
  assert(input.status === 200, 'create text input', `status ${input.status}`);

  const complete = await apiJson(`/api/monitoring-visits/${visitId}/complete`, {
    method: 'POST',
    token: craToken,
    body: JSON.stringify({ actualEndTime: '2026-07-15T17:40:00.000Z' }),
  });
  assert(complete.status === 200, 'complete visit + generate pack', `status ${complete.status}`);
  const packId = (complete.body.actionPack as { id: string }).id;
  assert(Boolean(packId), 'action pack id present');

  // 4) Confirm all items; force dirty data on fragile types first.
  // MODEL path may omit TASK — inject one so TASK href coverage is stable.
  let packGet = await apiJson(`/api/action-packs/${packId}`, { token: craToken });
  assert(packGet.status === 200, 'get action pack');
  let items = asItems(packGet.body);
  if (!items.some((i) => i.type === 'TASK')) {
    await prisma.actionItem.create({
      data: {
        actionPackId: packId,
        type: 'TASK',
        title: 'e2e 注入：补齐 03 号签字',
        description: 'MODEL 未生成 TASK 时的 e2e 覆盖项',
        data: JSON.stringify({ title: 'e2e 注入：补齐 03 号签字', dueDate: '补齐' }),
        status: 'PENDING_CONFIRM',
        origin: 'RULE',
      },
    });
    ok('injected TASK item (MODEL pack had none)');
    packGet = await apiJson(`/api/action-packs/${packId}`, { token: craToken });
    items = asItems(packGet.body);
  }
  // MODEL path may also omit REPORT_DRAFT — inject one to lock the report draft
  // persistence assertion. This guards the demo path that 5-min investors will see.
  if (!items.some((i) => i.type === 'REPORT_DRAFT')) {
    await prisma.actionItem.create({
      data: {
        actionPackId: packId,
        type: 'REPORT_DRAFT',
        title: '监查报告草稿',
        description: 'MODEL 未生成 REPORT_DRAFT 时的 e2e 覆盖项',
        data: JSON.stringify({
          title: '',
          sections: 'not-an-array',
          description: 'e2e injected report draft',
        }),
        status: 'PENDING_CONFIRM',
        origin: 'RULE',
      },
    });
    ok('injected REPORT_DRAFT item (MODEL pack had none)');
    packGet = await apiJson(`/api/action-packs/${packId}`, { token: craToken });
    items = asItems(packGet.body);
  }
  assert(items.length >= 5, `pack has items (≥5)`, `got ${items.length}`);
  assert(items.some((i) => i.type === 'TASK'), 'pack includes TASK');
  assert(items.some((i) => i.type === 'REPORT_DRAFT'), 'pack includes REPORT_DRAFT');

  const dirtyTypes = new Set([
    'TASK',
    'HOURS',
    'ISSUE',
    'FOLLOW_UP_ITEM',
    'REPORT_DRAFT',
    'MONITORING_VISIT_RECORD',
  ]);

  for (const item of items) {
    const base = (item.data && typeof item.data === 'object' ? item.data : {}) as Record<
      string,
      unknown
    >;
    const payload = dirtyTypes.has(item.type)
      ? { data: dirtyOverride(item.type, base) }
      : undefined;
    const confirm = await apiJson(`/api/action-packs/${packId}/items/${item.id}/confirm`, {
      method: 'POST',
      token: craToken,
      body: JSON.stringify(payload ?? {}),
    });
    assert(
      confirm.status === 200,
      `confirm ${item.type} (${item.title.slice(0, 20)})`,
      `status ${confirm.status} body=${JSON.stringify(confirm.body).slice(0, 200)}`,
    );
  }

  // 5) submit → PENDING_PM_REVIEW
  const submit = await apiJson(`/api/action-packs/${packId}/submit`, {
    method: 'POST',
    token: craToken,
    body: JSON.stringify({}),
  });
  assert(submit.status === 200, 'submit pack', `status ${submit.status}`);

  const visitAfterSubmit = await apiJson(`/api/monitoring-visits/${visitId}`, { token: craToken });
  const visitStatus = (visitAfterSubmit.body.visit as { status: string }).status;
  assert(visitStatus === 'PENDING_PM_REVIEW', 'visit PENDING_PM_REVIEW', `got ${visitStatus}`);

  // 6) CRA todos: TASK → action-pack?packId=
  const craTodos = await apiJson('/api/todos?scope=self', { token: craToken });
  assert(craTodos.status === 200, 'CRA todos load');
  const craList = (craTodos.body.todos as Array<{
    sourceType?: string;
    sourceId?: string;
    href?: string | null;
    title?: string;
  }>) ?? [];
  const taskTodo = craList.find((t) => t.sourceType === 'TASK' && t.sourceId === packId);
  assert(Boolean(taskTodo), 'CRA has TASK todo sourced to pack');
  assert(
    Boolean(taskTodo?.href?.includes(`action-pack?packId=${packId}`)),
    'TASK todo href → action-pack',
    `href=${taskTodo?.href}`,
  );

  // 7) PM team todos: PENDING_MY_REVIEW with review mode
  const pmTodos = await apiJson('/api/todos?scope=team', { token: pmToken });
  assert(pmTodos.status === 200, 'PM team todos load');
  const pmList = (pmTodos.body.todos as Array<{
    group?: string;
    sourceType?: string;
    sourceId?: string;
    href?: string | null;
  }>) ?? [];
  const reviewTodo = pmList.find(
    (t) => t.sourceType === 'ACTION_PACK' && t.sourceId === packId,
  );
  assert(Boolean(reviewTodo), 'PM has ACTION_PACK review todo');
  assert(
    Boolean(reviewTodo?.href?.includes('mode=review')),
    'PM review todo href has mode=review',
    `href=${reviewTodo?.href}`,
  );

  // 8) PM approve
  const review = await apiJson(`/api/reviews/action-packs/${packId}`, {
    method: 'POST',
    token: pmToken,
    body: JSON.stringify({ decision: 'APPROVE', comment: 'e2e 审核通过' }),
  });
  assert(review.status === 200, 'PM approve', `status ${review.status}`);

  const visitFinal = await apiJson(`/api/monitoring-visits/${visitId}`, { token: craToken });
  const finalStatus = (visitFinal.body.visit as { status: string } | undefined)?.status;
  assert(
    finalStatus === 'APPROVED' || review.body.visitStatus === 'APPROVED',
    'visit status APPROVED',
    `visit=${finalStatus} review.visitStatus=${review.body.visitStatus as string}`,
  );

  // 9) Fallback audit events present for dirty confirms
  const audit = await apiJson(`/api/audit/visit/${visitId}/full`, { token: craToken });
  assert(audit.status === 200, 'audit trail loads');
  const events = (audit.body.events as Array<{ type: string }>) ?? [];
  const types = events.map((e) => e.type);
  assert(types.includes('VISIT_STARTED'), 'audit has VISIT_STARTED');
  assert(types.includes('AI_GENERATED') || types.includes('AI_GENERATED_IDEMPOTENT'), 'audit has AI_GENERATED');
  assert(types.includes('PACK_SUBMITTED'), 'audit has PACK_SUBMITTED');
  assert(types.includes('PM_REVIEW'), 'audit has PM_REVIEW');
  assert(
    types.includes('ACTION_CONFIRMED_FALLBACK'),
    'audit has ACTION_CONFIRMED_FALLBACK from dirty fields',
  );

  // 10) Persistence: hours / issues / follow-up / report exist
  const hoursCount = await prisma.hoursRecord.count({ where: { monitoringVisitId: visitId } });
  const issueCount = await prisma.issue.count({ where: { monitoringVisitId: visitId } });
  const followUpCount = await prisma.followUpItem.count({ where: { monitoringVisitId: visitId } });
  const report = await prisma.reportDraft.findUnique({ where: { monitoringVisitId: visitId } });
  assert(hoursCount >= 1, `hours records ≥1 (got ${hoursCount})`);
  assert(issueCount >= 1, `issues ≥1 (got ${issueCount})`);
  assert(followUpCount >= 1, `follow-ups ≥1 (got ${followUpCount})`);
  assert(Boolean(report), 'report draft exists');
  const sections = JSON.parse(report!.sections) as unknown[];
  assert(Array.isArray(sections) && sections.length >= 1, 'report has ≥1 section');

}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log(`\nIMV e2e: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error('\nIMV e2e FAILED:', err instanceof Error ? err.message : err);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
