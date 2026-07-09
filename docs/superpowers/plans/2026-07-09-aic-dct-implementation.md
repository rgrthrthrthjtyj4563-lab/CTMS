# AIC-DCT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build AIC-DCT from the provided UI design book and supplied Web back-office prototype into a working AI-native decentralized clinical trial operating system.

**Architecture:** Use a modular monolith first, with separate Web, API, worker, mobile, and shared-domain packages. Productize `Web后台UI设计/` instead of redesigning Web from scratch: extract its pages/components/tokens, replace mock data with typed APIs, and treat AI output, audit, RBAC, masking, and clinical workflow state as core architecture.

**Tech Stack:** TypeScript, Next.js, React, Expo React Native, PostgreSQL, Prisma, BullMQ, Redis, S3-compatible object storage, typed API contracts.

---

## Plan Index

Execute these phase plans in order:

1. `docs/development-plans/phase-0-foundation.md`
2. `docs/development-plans/phase-1-web-shell-design-system.md`
3. `docs/development-plans/phase-2-core-clinical-workflows.md`
4. `docs/development-plans/phase-3-ai-risk-safety-audit.md`
5. `docs/development-plans/phase-4-mobile-provider-compliance.md`

Use these reference documents throughout:

- `docs/architecture/aic-dct-architecture-development-roadmap.md`
- `docs/development-plans/ai-execution-review-protocol.md`
- `docs/ui/web-prototype-inventory.md`
- `AIC-DCT UI Design Document.pdf`
- `Web后台UI设计/`

## Execution Tasks

### Task 1: Foundation

**Files:**

- Create and modify the files listed in `docs/development-plans/phase-0-foundation.md`.

- [ ] **Step 1: Read the phase plan**

Run:

```bash
sed -n '1,240p' docs/development-plans/phase-0-foundation.md
```

Expected: the worker understands repository scaffold, domain enums, schema, RBAC, audit, and API contract requirements.

- [ ] **Step 2: Implement Phase 0**

Follow every task in the phase plan.

- [ ] **Step 3: Verify Phase 0**

Run:

```bash
npm run lint
npm run typecheck
npm run test
```

Expected: all commands pass.

- [ ] **Step 4: Handoff for architect review**

Use the handoff format in `docs/development-plans/ai-execution-review-protocol.md`.

### Task 2: Web Shell And Design System

**Files:**

- Create and modify the files listed in `docs/development-plans/phase-1-web-shell-design-system.md`.

- [ ] **Step 1: Confirm Phase 0 passed architect review**

Expected: no unresolved Gate A rejection remains.

- [ ] **Step 2: Read the phase plan**

Run:

```bash
sed -n '1,260p' docs/development-plans/phase-1-web-shell-design-system.md
```

Expected: the worker understands shell layout, component inventory, dashboard scope, UI acceptance rules, and the requirement to productize `Web后台UI设计/src/app/App.tsx`.

- [ ] **Step 3: Implement Phase 1**

Follow every task in the phase plan.

- [ ] **Step 4: Verify Phase 1**

Run:

```bash
npm run lint
npm run typecheck
npm run test
```

Expected: all commands pass, and dashboard smoke test covers login -> project selection -> dashboard.

- [ ] **Step 5: Handoff for architect review**

Use the handoff format in `docs/development-plans/ai-execution-review-protocol.md`.

### Task 3: Core Clinical Workflows

**Files:**

- Create and modify the files listed in `docs/development-plans/phase-2-core-clinical-workflows.md`.

- [ ] **Step 1: Confirm Phase 1 passed architect review**

Expected: no unresolved Gate B rejection remains.

- [ ] **Step 2: Read the phase plan**

Run:

```bash
sed -n '1,280p' docs/development-plans/phase-2-core-clinical-workflows.md
```

Expected: the worker understands subject, consent, remote visit, ePRO, task, masking, audit requirements, and the relevant prototype pages in `Web后台UI设计/src/app/App.tsx`.

- [ ] **Step 3: Implement Phase 2**

Follow every task in the phase plan.

- [ ] **Step 4: Verify Phase 2**

Run:

```bash
npm run lint
npm run typecheck
npm run test
```

Expected: all commands pass, and E2E smoke covers subject list -> subject detail -> consent -> remote visit -> ePRO.

- [ ] **Step 5: Handoff for architect review**

Use the handoff format in `docs/development-plans/ai-execution-review-protocol.md`.

### Task 4: AI Risk, Safety, Reports, And Audit

**Files:**

- Create and modify the files listed in `docs/development-plans/phase-3-ai-risk-safety-audit.md`.

- [ ] **Step 1: Confirm Phase 2 passed architect review**

Expected: no unresolved Gate C rejection remains.

- [ ] **Step 2: Read the phase plan**

Run:

```bash
sed -n '1,320p' docs/development-plans/phase-3-ai-risk-safety-audit.md
```

Expected: the worker understands AI protocol parsing, AE/SAE, risk monitoring, reports, documents, audit, AI platform requirements, and the relevant prototype pages in `Web后台UI设计/src/app/App.tsx`.

- [ ] **Step 3: Implement Phase 3**

Follow every task in the phase plan.

- [ ] **Step 4: Verify Phase 3**

Run:

```bash
npm run lint
npm run typecheck
npm run test
```

Expected: all commands pass, and E2E smoke covers protocol parse -> effective version -> risk generation -> risk handling -> report draft -> export.

- [ ] **Step 5: Handoff for architect review**

Use the handoff format in `docs/development-plans/ai-execution-review-protocol.md`.

### Task 5: Mobile, Provider, Drug/Sample, And Compliance

**Files:**

- Create and modify the files listed in `docs/development-plans/phase-4-mobile-provider-compliance.md`.

- [ ] **Step 1: Confirm Phase 3 passed architect review**

Expected: no unresolved Gate D rejection remains for the Web back-office core.

- [ ] **Step 2: Read the phase plan**

Run:

```bash
sed -n '1,300p' docs/development-plans/phase-4-mobile-provider-compliance.md
```

Expected: the worker understands drug/sample, subject mobile, provider, and read-only compliance requirements.

- [ ] **Step 3: Implement Phase 4**

Follow every task in the phase plan.

- [ ] **Step 4: Verify Phase 4**

Run:

```bash
npm run lint
npm run typecheck
npm run test
```

Expected: all commands pass, and smoke tests cover subject mobile, provider task, and read-only audit denial.

- [ ] **Step 5: Handoff for architect review**

Use the handoff format in `docs/development-plans/ai-execution-review-protocol.md`.

## Final Acceptance

The implementation is not accepted until:

- All phase checks pass.
- The app runs locally from a clean checkout.
- Web back office covers all first-phase pages from the PDF.
- Web back office remains visually and interactively aligned with `Web后台UI设计/` unless deviations are documented and accepted.
- Subject mobile covers the required second-phase flows.
- Provider and read-only audit views cover the required third-phase flows.
- AI outputs are labeled, sourced, versioned, logged, and human-confirmed.
- Critical operations are audited.
- Sensitive data is masked by default.
- High-risk and SAE workflows cannot be silently closed.
- The UI remains professional, restrained, data-clear, and suitable for clinical-trial operations.
