# Phase 3 Task 3.7 — Closure Criteria And Implementation Plan

> **Status**: Task 3.6 is committed (`56e37d9`). Phase 3 enters closure.
> This document is the Phase 3 Done definition and the implementation
> brief for Task 3.7. Nothing here opens M4A / Phase 4.

## Phase 3 Done Definition (acceptance gate)

All six items below MUST hold before Phase 3 is reported Done:

1. **Full list isolation (R2)** — every list / aggregate / export
   endpoint that supports `?projectId=` resolves the scope via
   `resolveProjectScope(user, queryProjectId, requestId)`. A caller
   without an assignment on the requested project receives `403
   FORBIDDEN` (never an empty / cross-project result).
2. **Full detail / write isolation (R2)** — every detail or mutating
   endpoint loads the row, then calls `assertProjectAccess(user,
   row.projectId, requestId)` against the row's `projectId`. A row
   from a project the caller is not assigned to returns `403` (or
   `404` if the row lookup already returned empty).
3. **Per-project role authorization (R1)** — every mutating endpoint
   calls `resolveActorRoleForProject(user, targetProjectId, req.id)`
   and passes the resolved `{ userId, projectId, role }` to
   `authorize(...)`. A Sponsor on project A cannot use project-A
   authority on a row that belongs to project B; the per-project role
   is the only role evaluated.
4. **AI promotion gate** — protocol activation and report confirmation
   (and any other "promote AI draft to live" endpoint added in the
   future) MUST reject with `AI_CONFIRMATION_REQUIRED` (or the
   domain's existing equivalent error code) when the relevant
   `AIOutput.status` is not `Adopted` or `EditedAdopted`. The check
   lives in the server route, not only in the Web UI.
5. **Integration tests** — automated coverage for at least:
   - cross-project list `?projectId=<other>` → 403;
   - cross-project detail / mutate on a row from project B → 403;
   - protocol activate / report confirm fail when the linked
     `AIOutput.status` is `Pending`;
   - protocol activate / report confirm succeed when the linked
     `AIOutput.status` is `Adopted` (subject to other business rules).
6. **Task 3.6 contract sync** — `docs/domain/rbac-matrix.md` `ai:
   config.update` row matches `packages/domain/src/rbac.ts`
   `ROLE_PERMISSIONS` for every role, `packages/domain/src/rbac.test.ts`
   asserts the matrix, and `docs/api/openapi.yaml` lists
   `/api/ai-config/*` with proper schemas and error envelopes (Task
   3.6 commit `56e37d9`).

## Task 3.7 Implementation

### 3.7.1 Shared helpers (in `apps/api/src/lib/auth.ts`)

Already shipped in Task 3.6 commit `56e37d9`:

- `resolveProjectScope(user, queryProjectId?, requestId)` — list filter.
- `assertProjectAccess(user, targetProjectId, requestId)` — detail /
  write isolation.
- `resolveActorRoleForProject(user, targetProjectId, requestId)` —
  returns `{ userId, projectId, role }` for `authorize()`.
- `audit` / `auditTx` — already in use.

No new helpers are needed for Task 3.7; existing helpers are reused.

### 3.7.2 Per-route coverage

For every route file below, both list and detail/write paths are
audited. The pattern is:

```
const user = await requireUser(req);

// list / aggregate
const projectId = resolveProjectScope(user, queryProjectId, req.id);

// detail / write
const row = await loadScoped(...); // findUnique, then assertProjectAccess
const actor = resolveActorRoleForProject(user, row.projectId, req.id);
authorize({ userId: actor.userId, role: actor.role }, Permission.X, { requestId: req.id });
// mutate + audit (use $transaction + auditTx on critical paths)
```

Routes in scope (Phase 3 closure; every file is touched if it has any
list or mutation):

- `apps/api/src/routes/subjects.ts`
- `apps/api/src/routes/consent.ts`
- `apps/api/src/routes/visits.ts`
- `apps/api/src/routes/epro.ts`
- `apps/api/src/routes/safety.ts`
- `apps/api/src/routes/risks.ts`
- `apps/api/src/routes/protocol.ts`
- `apps/api/src/routes/reports.ts`
- `apps/api/src/routes/dashboard.ts` (project filter only)
- `apps/api/src/routes/documents.ts`
- `apps/api/src/routes/audit.ts`
- `apps/api/src/routes/ai-config.ts` (already aligned with R1 + R2 in
  Task 3.6; spot-checked in Task 3.7)

Forbidden pattern (do not leave behind):

```
projectId: projectId ?? user.projectId   // no assignment check
```

### 3.7.3 AI promotion gates (business entry, not just UI)

#### A. Protocol activation — `apps/api/src/routes/protocol.ts`

`POST .../activate`:

1. Before allowing the activation transition, look up the protocol
   version's linked `AIProtocolParseResult` and the latest `AIOutput`
   that targets it.
2. If any AI output exists for the version, the row MUST be in
   `Adopted` or `EditedAdopted` (per `canPromoteAIOutput`). Otherwise
   throw `ApiErrorException(AI_CONFIRMATION_REQUIRED, ...)`.
3. Edge case: if the system allows a "purely manual" version with no
   AI artifact, document that explicitly. Default behaviour: any
   AI artifact present must be Adopted first.

#### B. Report confirmation — `apps/api/src/routes/reports.ts`

`POST .../confirm`:

1. If `report.sourceSnapshotId` (or equivalent) points at an
   `AIOutput`, the output MUST be `Adopted` / `EditedAdopted`. Else
   throw `AI_CONFIRMATION_REQUIRED`.
2. On success the report still goes through the existing
   `REPORT_STATUS_TRANSITIONS` flow; AI state is not mutated here.

#### C. Forbidden

- Do NOT hide the action button in the Web UI only — the API must
  enforce.
- Do NOT auto-adopt on the caller's behalf.

### 3.7.4 Protocol status machine

If `activate` currently requires `UnderReview` and the worker only
reaches `Parsed`, add a legal `Parsed → UnderReview` API surface
(submit-for-review) so the activation path is reachable via HTTP,
not via direct DB writes. Any change to `PROTOCOL_PARSE_TRANSITIONS`
must be paired with a domain test and a doc note.

Forbidden: in tests, use `prisma.update` to skip status transitions
and pretend the happy path was reached.

## Data-Attribution Principles (for M4A / Phase 4 — written here, not implemented)

These principles are recorded now so M4A can adopt them without
re-litigating the contract. Task 3.7 does NOT implement them; it
only writes the principle.

- **Source of truth**: by default, Subject-original data is created
  by an authenticated Subject identity (Subject role) and bound to
  one subject record server-side. The client never supplies a
  `subjectId` that overrides this binding.
- **Web back office**: monitors, queries, and handles Subject-original
  data. The Web MUST NOT silently mutate the original payload (e.g.
  ePRO answers, symptom reports). Corrections, if any, go through a
  distinct, audited correction flow.
- **CRC assisted-entry**: when staff-assisted entry is approved by
  workflow, it produces a distinct `AssistedEntry` record with a
  strong audit chain (who, when, why, original vs. assisted).
  Assisted-entry MUST NOT impersonate a Subject self-entry or
  surrogate-sign an informed consent.
- **Demo / smoke data**: Phase 3 / 3.7 demos are seeded via
  `apps/api/prisma/seed.ts`. Demo scripts MUST NOT advertise seed
  data as Subject source data. M4A introduces a real Subject
  channel; demos must clearly mark data origin.

## Scope Locked (explicit non-goals)

Task 3.7 does NOT do:

- Provider surfaces (Logistics / Nurse task views).
- Drug / sample / cold-chain operations.
- Real LLM integration; Phase 3 still uses the deterministic mock
  provider.
- BullMQ / Redis / external queue.
- Production OIDC / SAML SSO.
- Phase 4A / 4B / 4C subject experience, mobile app, or provider
  work. Those are out of scope until Phase 3 Done is reported.
- Any change to the Web back-office UI design directory
  (`Web后台UI设计/`).

## Verification

After Task 3.7 implementation:

```
cd "/Users/lee/Developer/PersonalProjects/个人研发项目/临床试验"
npm run typecheck
npm run lint
npm run test --workspace=packages/domain
npm run test --workspace=apps/api
npm run test --workspace=apps/web
```

All must pass. The Phase 3 Done report (separate doc) records
command output, route coverage, and AI-gate behaviour.

## Commit Message Conventions

- `fix(phase-3): Task 3.7 project isolation + AI promotion gates`
- `docs(phase-3): Task 3.7 closure criteria + phase-4 split note`