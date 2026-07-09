# Phase 0 Foundation Development Plan

## Goal

Create the engineering contract and local foundation that every later AIC-DCT feature depends on.

## Scope

This phase does not build every product page. It creates the repository structure, data contracts, auth/RBAC foundation, audit taxonomy, AI output lifecycle, seed data, and verification commands.

## Recommended Files To Create

- `apps/web/`: Next.js Web back office.
- `apps/api/`: TypeScript backend API.
- `apps/worker/`: queue workers for AI jobs, reports, risk checks, and reminders.
- `packages/domain/`: shared domain types, enums, zod schemas.
- `packages/ui/`: shared Web UI primitives after Phase 1 begins.
- `packages/config/`: shared lint, TypeScript, and formatting config.
- `prisma/schema.prisma`: database schema.
- `prisma/seed.ts`: demo study seed data.
- `docs/domain/glossary.md`: clinical and product vocabulary.
- `docs/domain/rbac-matrix.md`: role-permission matrix.
- `docs/domain/audit-taxonomy.md`: audit event definitions.
- `docs/domain/ai-output-lifecycle.md`: AI output states and confirmation rules.
- `docs/api/openapi.yaml`: API contract.

## Domain Contracts

### Core Roles

- `SponsorAdmin`
- `CROPM`
- `SitePI`
- `SiteCRC`
- `CRA`
- `Auditor`
- `RegulatorReadOnly`
- `Subject`
- `ProviderLogistics`
- `ProviderNurse`
- `SystemAdmin`

### Required State Enums

- `ProtocolParseStatus`: `Uploaded`, `Parsing`, `Parsed`, `ParseFailed`, `UnderReview`, `Effective`, `Superseded`
- `HumanConfirmationStatus`: `Pending`, `Adopted`, `EditedAdopted`, `Rejected`, `NeedsInvestigatorConfirmation`
- `SubjectStatus`: `PreScreening`, `Consenting`, `Screening`, `Enrolled`, `Active`, `Completed`, `Withdrawn`, `ScreenFailed`
- `VisitStatus`: `NotStarted`, `Scheduled`, `InProgress`, `SubmittedForPI`, `Completed`, `Missed`, `OutOfWindow`, `Deviation`
- `ConsentStatus`: `NotStarted`, `Reading`, `ComprehensionPending`, `SubjectSigned`, `InvestigatorSigned`, `Completed`, `ReConsentRequired`, `Withdrawn`
- `QuestionnaireStatus`: `Scheduled`, `InProgress`, `Submitted`, `Missed`, `Late`, `Reviewed`
- `SafetyEventStatus`: `Draft`, `InvestigatorReview`, `ConfirmedAE`, `ConfirmedSAE`, `Reported`, `FollowUp`, `Closed`
- `RiskLevel`: `Low`, `Medium`, `High`, `Critical`
- `RiskStatus`: `Open`, `Assigned`, `InProgress`, `PendingInvestigator`, `Resolved`, `Closed`, `Rejected`
- `ReportStatus`: `Generating`, `Draft`, `UnderReview`, `Confirmed`, `Exported`, `Failed`

## Implementation Tasks For AI Worker

### Task 0.1 - Scaffold Repository

Deliver:

- Package manager workspace.
- `apps/web`, `apps/api`, `apps/worker`, `packages/domain`, `packages/config`.
- Root scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed`.

Acceptance:

- `npm run lint` succeeds.
- `npm run typecheck` succeeds.
- `npm run test` succeeds with at least one smoke test per app/package.

### Task 0.2 - Create Shared Domain Types

Deliver:

- Shared enums listed above.
- Shared zod schemas for project, subject, visit, consent, questionnaire, safety event, risk, AI output, audit event.
- Unit tests proving invalid lifecycle values are rejected.

Acceptance:

- No feature module defines duplicate lifecycle string unions.
- Tests cover accepted and rejected enum values.

### Task 0.3 - Create Database Schema V0

Deliver:

- Project, site, user, role assignment.
- Subject and masked identity fields.
- Protocol version and AI parsed protocol result.
- Consent document, consent task, signature record.
- Visit, visit task, remote visit record.
- Questionnaire template and response.
- Safety event and safety follow-up.
- Risk signal and risk handling record.
- Drug shipment and sample transfer.
- Report draft and export record.
- Document and document version.
- AI config, prompt template, AI call log, AI output.
- Audit event.

Acceptance:

- Migration applies to a clean database.
- Seed creates one complete demo study with at least two sites, six users, eight subjects, visits, questionnaires, risks, one AE, one possible SAE, drug shipment, sample transfer, and AI outputs.

### Task 0.4 - Create RBAC And Audit Contracts

Deliver:

- `docs/domain/rbac-matrix.md`.
- `docs/domain/audit-taxonomy.md`.
- Server helper for authorization checks.
- Server helper for audit event creation.
- Tests for allowed, denied, and audit-required actions.

Acceptance:

- Critical actions cannot be called without authorization.
- Critical actions create audit events in tests.

### Task 0.5 - Create API Contract

Deliver:

- `docs/api/openapi.yaml`.
- API route skeletons for auth, projects, dashboard, subjects, consent, visits, ePRO, safety, risks, drugs/samples, reports, documents, AI config, audit.
- Contract tests for route shape and error format.

Acceptance:

- API returns typed JSON.
- Errors use one consistent structure: `code`, `message`, `details`, `requestId`.

## Architect Review Gate

Do not start Phase 1 until:

- The local app can be installed and checked.
- The schema and shared enums are accepted.
- RBAC, audit, and AI output lifecycles are explicit.
- Seed data supports the first dashboard without hardcoded UI-only records.

