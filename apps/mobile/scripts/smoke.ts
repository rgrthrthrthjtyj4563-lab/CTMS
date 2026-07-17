/**
 * Functional smoke: fails hard on business assertion errors.
 * Exit codes:
 *   0 = pass
 *   1 = assertion / workflow failure
 *   2 = API server unavailable (explicit skip for optional local runs — still non-zero)
 */

const colors = {
  bg: '#F4F5F7',
  primary: '#0B7070',
  dark: '#0B2E2E',
  text: '#111827',
};

const radius = { button: 6, card: 8 };

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
/** Set SMOKE_ALLOW_OFFLINE=1 to exit 0 when API is down (not for CI). */
const ALLOW_OFFLINE = process.env.SMOKE_ALLOW_OFFLINE === '1';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function apiJson(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { token, ...rest } = init;
  const res = await fetch(`${API_BASE}${path}`, {
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

async function apiWorkflow() {
  const login = await apiJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: '13800138001', password: 'password' }),
  });
  assert(login.status === 200, 'CRA login should succeed');
  const token = login.body.token as string;
  assert(Boolean(token), 'token required');

  const wb = await apiJson('/api/workbench', { token });
  assert(wb.status === 200, 'workbench should load');
  const context = wb.body.context as { projectCode?: string };
  assert(context.projectCode === 'AJ-001', 'workbench context should include project');

  const planned = (wb.body.plannedVisits as Array<{ id: string; status: string }>) ?? [];
  const active = wb.body.activeVisit as { id: string; status: string } | null;
  let visitId: string | undefined = active?.id ?? planned[0]?.id;

  if (!visitId) {
    // Fallback: any CRA visit still open
    const list = await apiJson('/api/monitoring-visits', { token });
    assert(list.status === 200, 'list visits should succeed');
    const visits = (list.body.visits as Array<{ id: string; status: string }>) ?? [];
    const open = visits.find((v) => ['PLANNED', 'IN_PROGRESS'].includes(v.status));
    visitId = open?.id;
  }
  assert(
    Boolean(visitId),
    'should have a visit for smoke — run `pnpm db:seed` to create today IMV',
  );
  const resolvedVisitId = visitId as string;

  const plannedOnly = planned.find((v) => v.status === 'PLANNED');
  const visitToUse = plannedOnly?.id ?? resolvedVisitId;

  const start = await apiJson(`/api/monitoring-visits/${visitToUse}/start`, {
    method: 'POST',
    token,
    body: JSON.stringify({}),
  });
  assert(start.status === 200, `start visit should succeed, got ${start.status}`);
  console.log('start visit: OK');

  const act = await apiJson(`/api/monitoring-visits/${visitToUse}/activities`, { token });
  assert(act.status === 200, 'activities should load');
  const activities = act.body.activities as Array<{ id: string }>;
  assert(activities.length >= 4, 'should seed visit activities');
  console.log(`activities: ${activities.length}`);

  const inputRes = await apiJson(`/api/monitoring-visits/${visitToUse}/inputs`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      type: 'TEXT',
      content:
        '今天在华山医院做了IMV，9:10到17:40。核对了12例受试者，发现03号受试者两份原始记录未签字。',
      clientInputId: `smoke-${Date.now()}`,
    }),
  });
  assert(inputRes.status === 200, 'add input should succeed');
  const inputId = (inputRes.body.input as { id: string }).id;

  const edit = await apiJson(`/api/monitoring-visits/${visitToUse}/inputs/${inputId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      content: '今天在华山医院做了IMV，9:10到17:40。核对了12例。',
      reason: 'smoke 修正',
    }),
  });
  assert(edit.status === 200, 'edit input should succeed');
  console.log('edit input: OK');

  const complete1 = await apiJson(`/api/monitoring-visits/${visitToUse}/complete`, {
    method: 'POST',
    token,
    body: JSON.stringify({ actualEndTime: new Date().toISOString() }),
  });
  assert(complete1.status === 200, 'complete should succeed');
  const packId = (complete1.body.actionPack as { id: string } | null)?.id;
  assert(Boolean(packId), 'complete should return action pack');
  console.log('complete visit: OK', packId);

  const complete2 = await apiJson(`/api/monitoring-visits/${visitToUse}/complete`, {
    method: 'POST',
    token,
    body: JSON.stringify({ actualEndTime: new Date().toISOString() }),
  });
  assert(complete2.status === 200, 'second complete must not fail');
  assert(
    (complete2.body.actionPack as { id: string }).id === packId,
    'second complete must reuse same pack',
  );
  assert(complete2.body.idempotent === true, 'second complete should be idempotent');
  console.log('complete idempotent: OK');

  const patch = await apiJson(`/api/monitoring-visits/${visitToUse}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ workSummary: 'smoke 总结确认' }),
  });
  assert(patch.status === 200, 'patch visit should succeed');

  const hours = await apiJson('/api/hours?month=2026-07', { token });
  assert(hours.status === 200, 'hours month query should succeed');
  console.log('hours month: OK');

  const todos = await apiJson('/api/todos', { token });
  assert(todos.status === 200, 'todos should load');
  for (const t of (todos.body.todos as Array<{ href?: string | null }>) ?? []) {
    assert('href' in t, 'todo should expose href field');
  }
  console.log('todos href: OK');

  // PM review path smoke (login as PM)
  const pmLogin = await apiJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: '13800138002', password: 'password' }),
  });
  if (pmLogin.status === 200) {
    const pmToken = pmLogin.body.token as string;
    const pmTodos = await apiJson('/api/todos', { token: pmToken });
    assert(pmTodos.status === 200, 'PM todos should load');
    console.log('PM todos: OK');
  }

  console.log(`workbench: ${planned.length} planned visit(s)`);
}

async function main() {
  assert(colors.bg === '#F4F5F7', 'bg should be #F4F5F7');
  assert(colors.primary === '#0B7070', 'primary should be #0B7070');
  assert(radius.button === 6, 'button radius should be 6');

  let healthOk = false;
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (res.ok) {
      const body = (await res.json()) as { status?: string };
      assert(body.status === 'ok', 'health check should return status:ok');
      healthOk = true;
      console.log('API health: OK');
    }
  } catch {
    healthOk = false;
  }

  if (!healthOk) {
    console.error(`API unavailable at ${API_BASE}`);
    if (ALLOW_OFFLINE) {
      console.error('SMOKE_ALLOW_OFFLINE=1 → exit 0 (not for CI)');
      process.exit(0);
    }
    process.exit(2);
  }

  await apiWorkflow();
  console.log('smoke: all checks passed');
}

main().catch((err) => {
  console.error('smoke failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
