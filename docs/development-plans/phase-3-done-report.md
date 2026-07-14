# Phase 3 Done Report — 2026-07-14

> **Status**: **Phase 3 Done**. All six acceptance gates below are
> satisfied. **Phase 4 / M4A is unblocked.** No M4A work has been
> opened in this repository yet.

## Acceptance gate results

| # | Gate | Evidence |
|---|------|----------|
| 1 | R2 list isolation across every list / aggregate / export endpoint that supports `?projectId=`. | `apps/api/src/routes/{subjects,consent,visits,epro,safety,risks,protocol,reports,dashboard}.ts` all use `resolveProjectScope(user, projectId, req.id)`. `apps/api/src/routes/phase3-closure.test.ts` lines 166-184 assert 403 for every list path when `projectId=<other>`. |
| 2 | R2 detail / write isolation: load scoped helper → `assertProjectAccess(user, row.projectId, req.id)`; mutated rows return 403 on cross-project. | `loadSubjectScoped / loadTaskScoped / loadVisitScoped / loadResponseScoped / loadEventScoped / loadRiskScoped / loadVersionScoped / loadReportScoped` all do `assertProjectAccess` against `row.projectId` (subject.projectId / visit.subject.projectId / response.subjectId → subject.projectId). `phase3-closure.test.ts` lines 186-216 assert 403 for detail / write paths. |
| 3 | R1 per-project role: every mutating endpoint calls `resolveActorRoleForProject(user, targetProjectId, req.id)` and passes the resolved `{ userId, projectId, role }` to `authorize(...)`. | Shared helper exported from `apps/api/src/lib/auth.ts` (Task 3.6 commit `56e37d9`). Reused by every route in Task 3.7 commit `2861074`. `phase3-closure.test.ts` line 218 asserts a Sponsor on A cannot adopt an AI output on B. `ai-config.test.ts` Task 3.6 tests assert the same for AIConfigUpdate and AIOutputAdopt. |
| 4 | AI promotion gate on protocol activate and report confirm; the server enforces, not the Web UI. | `apps/api/src/routes/protocol.ts` lines ~378-419 (activate) reject with `AI_CONFIRMATION_REQUIRED` when any linked `AIProtocolParseResult.aiOutput` is not `Adopted` / `EditedAdopted`. `apps/api/src/routes/reports.ts` lines ~277-310 (confirm) reject with `AI_CONFIRMATION_REQUIRED` when `sourceSnapshotId` points at a Pending `AIOutput`. Both verified by `phase3-closure.test.ts` lines 224-281. |
| 5 | Integration tests for cross-project 403, cross-project mutate 403, AI gate reject, AI gate accept. | `apps/api/src/routes/phase3-closure.test.ts` (new, 18 tests, 100% pass). `apps/api/src/routes/ai-config.test.ts` Task 3.6 R1/R2 coverage (still green). |
| 6 | Task 3.6 contract sync: `rbac-matrix.md` ↔ `rbac.ts` ↔ `rbac.test.ts` + `/api/ai-config/*` openapi. | Task 3.6 commit `56e37d9` synced `ai:config.update` row, added the matrix assertion test, and rewrote `/api/ai-config/*` in `openapi.yaml`. |

## Verification commands (last run 2026-07-14)

```
$ npm run typecheck
0 errors

$ npm run lint
8 warnings, 0 errors
  - 7 pre-existing unused vars (not introduced by Phase 3)
  - 1 pre-existing test-fixture unused var

$ npm run test --workspace=packages/domain
  Tests  71 passed (71)

$ npm run test --workspace=apps/api
  Tests  155 passed (155)
    - 137 existing tests
    - 18 new tests in apps/api/src/routes/phase3-closure.test.ts

$ npm run test --workspace=apps/web
  Tests  10 passed (10)
```

## Phase 3 deliverables shipped

- **Task 3.6** — AI platform: `/api/ai-config/*` surface (configs,
  prompts, call logs, outputs, adopt / reject). R1 per-project role
  + R2 project isolation enforced. Commits: `56e37d9`.
- **Task 3.7** — Closure: full API project isolation + AI promotion
  gates + integration tests. Commits: `2861074`.

## Route-level coverage (R1 + R2 + AI gate where applicable)

| Route | R2 list | R2 detail | R1 per-project | AI gate |
|-------|---------|-----------|----------------|---------|
| subjects | yes | yes | create | n/a |
| consent | yes | yes | create | n/a |
| visits | yes | yes | create (schedule) | n/a |
| epro | yes | yes | start | n/a |
| safety | yes | yes | draft / confirm / report / follow-up / close | n/a |
| risks | yes | yes | assign / start / resolve / close / reject | n/a |
| protocol | yes | yes | upload / parse / submit-for-review / activate | activate |
| reports | yes | yes | generate / confirm / export | confirm |
| dashboard | yes (requireProject) | n/a | n/a | n/a |
| ai-config | yes (Task 3.6) | yes (Task 3.6) | yes (Task 3.6) | n/a (outputs themselves are the gate target) |
| documents | yes (Task 3.5) | yes (Task 3.5) | yes (Task 3.5) | n/a |
| audit | yes (Task 3.5) | n/a | n/a | n/a |

## Phase 3 — scope explicitly NOT included

These are out of Phase 3 by design and must NOT be opened until
Phase 3 Done has been acknowledged and M4A is approved:

- Subject API surface (my-tasks, ePRO submit from Subject identity).
- Subject mobile shell or Expo harness.
- Provider surfaces (Logistics / Nurse task views).
- Drug dispatch / receive and sample collect / transfer / cold chain.
- Regulator read-only surface.
- Real LLM integration (Phase 3 uses the deterministic mock
  provider).
- BullMQ / Redis / external queue workers.
- Production OIDC / SAML SSO.
- Web back-office UI design directory
  (`Web后台UI设计/`) — frozen.

See [phase-3-task-3-7-closure.md](./phase-3-task-3-7-closure.md)
and [phase-4-mobile-provider-compliance.md](./phase-4-mobile-provider-compliance.md)
for the scope split.

## Outstanding decisions for the next agent

1. **M4A scheduling**: when to start Phase 4A (Subject source-data
   loop) work. Phase 3 is unblocked as of this commit.
2. **Provider surfaces (M4C)**: keep as Phase 4C; no work begins
   before the Subject boundary stabilises in M4A.
3. **Real LLM**: not opened in Phase 3. The mock provider is good
   enough to exercise the gate; real provider integration can be
   M4B or later.

## Open the next workstream

A new agent may start M4A only after the user explicitly approves
moving past Phase 3. Until then, this Done report stands and no
M4A commit should land on `main`.