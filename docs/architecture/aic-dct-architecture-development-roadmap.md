# AIC-DCT Architecture And Development Roadmap

> Sources reviewed:
>
> - `AIC-DCT UI Design Document.pdf`, 40 pages, extracted on 2026-07-09.
> - `Web后台UI设计/`, reviewed on 2026-07-09. This is a runnable Vite/React Figma Make prototype and is the primary Web back-office visual and interaction baseline.
> - `docs/ui/web-prototype-inventory.md`, created on 2026-07-09 as the implementation inventory for the prototype.
> - `docs/decisions/2026-07-14-phase-3-closure-and-subject-source-data.md`, the accepted delivery and source-data boundary decision.

## 1. Architect Assessment

The PDF design document is a strong UI and product interaction specification. It defines the product surface, visual system, page inventory, AI display rules, risk states, audit expectations, role visibility, and major workflows.

The newly supplied `Web后台UI设计/` directory changes the engineering plan materially. It is not only a design note; it is a working Web back-office prototype with:

- Vite, React, TypeScript-style TSX, Tailwind CSS v4, shadcn/Radix primitives, lucide-react, and Recharts.
- One consolidated prototype file at `Web后台UI设计/src/app/App.tsx`.
- Web pages for login, dashboard, AI protocol parsing, subjects, subject detail, electronic consent, remote visit, ePRO/eCOA, AE/SAE, risk monitoring, drug/sample, reports, documents/audit, AI platform config, and system settings.
- Concrete visual tokens in `Web后台UI设计/src/styles/theme.css`.
- Mock clinical data, risk data, audit logs, modal patterns, drawer patterns, cards, tables, AI labels, risk labels, and navigation.

Therefore, the Web implementation should not start from a blank UI interpretation. It should treat the prototype as the baseline to be productized: split the large prototype into maintainable components, preserve the successful visual system, replace mock data with typed backend APIs, and add the missing server-side workflow, RBAC, audit, and AI lifecycle guarantees.

It is not yet a complete technical system design. The implementation plan therefore treats this PDF as the product contract and adds the missing engineering contracts that other AI workers must create before implementation hardens:

- Domain model and event model.
- Role-based access control matrix.
- Audit trail schema.
- AI output lifecycle and human-confirmation lifecycle.
- API contracts for Web, subject mobile, provider, and read-only audit views.
- Data retention, desensitization, export, and medical safety boundaries.
- Integration boundaries for video visit, e-signature, logistics, lab/sample tracking, and model providers.

## 2. Product Scope From The Design Book And Web Prototype

### Web Back Office

The first releasable product surface is the Web back office for sponsor, CRO, site, PI, CRC, CRA, PM, and system admins.

Required modules:

- Login and project selection.
- Project dashboard.
- AI protocol parsing.
- Subject list and subject detail.
- Electronic informed consent management.
- Remote visit workstation.
- ePRO/eCOA management.
- AE/SAE safety event detail.
- AI risk monitoring dashboard.
- Drug and sample management.
- Report center.
- Documents and audit.
- AI platform configuration.
- System settings.

The Web prototype already implements the above first-phase modules visually. Engineering work should use these concrete prototype anchors:

- `Sidebar`, `Topbar`, `MainLayout` for the application shell.
- `Btn`, `RiskBadge`, `AITag`, `StatusTag`, `KPICard`, `RiskCard`, `AISuggestionCard`, `Tabs`, `DataTable`, `Modal`, `Drawer`, `AuditTrail`, `ProgressBar`, `InfoRow`, `EmptyState` as component extraction candidates.
- `DashboardPage`, `ProtocolPage`, `SubjectsPage`, `SubjectDetailPage`, `RemoteVisitPage`, `AESAEPage`, `RiskMonitorPage`, `EConsentPage`, `EPROPage`, `DrugsPage`, `ReportsPage`, `DocumentsPage`, `AIConfigPage`, and `SettingsPage` as page extraction candidates.
- `SUBJECTS`, `RISK_ITEMS`, `ENROLLMENT_DATA`, `RISK_TREND`, `CENTER_RISK`, and `AUDIT_LOGS` as seed-data shape references, not production data sources.

The detailed extraction map is in `docs/ui/web-prototype-inventory.md`.

### Subject Mobile

The second product surface is the subject-facing mobile app.

Required modules:

- Subject home.
- My tasks.
- Electronic consent.
- Consent Q&A.
- Electronic signature.
- Visit calendar.
- Remote visit.
- ePRO questionnaire.
- Medication check-in.
- Symptom report.
- File upload.
- My profile.

Subject mobile is the default origin for Subject-reported source data. The Web back office may monitor, query, confirm, and handle those records, but it must not silently impersonate a Subject or overwrite an original Subject response. Approved staff-assisted entry is a separately labelled, fully audited record; it is not Subject self-entry.

### Provider And Audit Surfaces

The third product surface includes service-provider and read-only audit roles.

Required modules:

- Logistics tasks.
- Sample collection tasks.
- Home nurse tasks.
- Audit read-only view.
- Regulator and ethics read-only view.

## 3. Recommended System Architecture

### 3.1 Application Shape

Use a modular monolith first, with clear domain boundaries. A distributed microservice architecture is premature for the first build because the highest-risk work is domain correctness, auditability, workflow integrity, and turning the supplied prototype into maintainable product code rather than independent scaling.

Recommended deployment units:

- `web-app`: Web back office UI.
- `mobile-app`: Subject mobile UI.
- `api-app`: Backend API, domain services, auth, audit, jobs.
- `worker-app`: AI parsing, report generation, notification dispatch, risk scoring, scheduled checks.
- `admin-tools`: seed data, migrations, smoke tests, audit export verification.

### 3.2 Recommended Technology Stack

If no existing engineering stack is imposed, use:

- Frontend Web: React with TypeScript, Tailwind CSS, shadcn/Radix-compatible primitives, lucide-react, Recharts. Next.js App Router is acceptable if the team wants server routing, but the supplied `Web后台UI设计/` prototype is Vite/React and should be migrated deliberately rather than rewritten blindly.
- Mobile: Expo React Native, TypeScript.
- Backend: NestJS or Fastify with TypeScript.
- Database: PostgreSQL.
- ORM: Prisma.
- Queue: BullMQ plus Redis.
- Object storage: S3-compatible storage for uploaded documents, consent files, reports, and exports.
- Auth: OIDC/SAML-ready identity layer with application RBAC.
- AI: provider adapter interface with prompt-template versioning, request/response logging, and human-confirmation states.
- Video: adapter interface around a commercial video provider.
- E-signature: adapter interface around a compliant e-sign provider.

This stack is chosen because the product is TypeScript-heavy, data-table-heavy, workflow-heavy, and audit-heavy. It also matches the supplied prototype closely enough that UI decisions can be preserved while backend and compliance contracts are added.

### 3.2.1 Web Prototype Productization Strategy

The `Web后台UI设计/` code should be treated as design source and extraction source, not as final production architecture.

Rules:

- Preserve the visual language unless a concrete usability, accessibility, or clinical-safety issue is found.
- Extract the large `App.tsx` into page modules, domain components, shared UI primitives, mock/seed adapters, and typed API clients.
- Do not leave business state transitions inside local React state once backend contracts exist.
- Replace prototype mock arrays with backend seed data shaped to the same UI needs.
- Keep modal and drawer interaction patterns, but enforce required reasons and confirmations server-side.
- Keep the prototype's compact B-end information density.
- Keep the dark sidebar plus white topbar shell unless later user testing rejects it.
- Use the prototype's token set as the Phase 1 design-token baseline, then reconcile with the PDF where values differ.

### 3.2.2 Token Reconciliation

The PDF suggested primary `#1E4E8C`, AI `#6366F1`, and background `#F5F7FA`.

The Web prototype uses:

- Primary: `#0B4DA2`
- Sidebar: `#0A1628`
- Sidebar selected: `#3B8BF5`
- AI/accent: `#6B52D9`
- Background: `#EEF1F7`
- Low risk: `#16A34A`
- Medium risk: `#D97706`
- High risk: `#EA580C`
- Critical risk: `#DC2626`

Decision: use the prototype tokens for Web implementation because they reflect the actual supplied UI. Keep the PDF values as product intent and acceptable fallback, not as a reason to overwrite the prototype.

### 3.3 Domain Boundaries

Implement these domain modules as explicit boundaries:

- Identity and access: users, roles, permissions, project membership, role switching.
- Project and study protocol: projects, protocol versions, AI parsed protocol configuration, effective study configuration.
- Sites and subjects: centers, subject lifecycle, visit timeline, subject risk status.
- Consent: ICF documents, versions, reading progress, comprehension checks, e-signature state, re-consent tasks.
- Visits: visit windows, visit tasks, remote visit session, visit notes, visit completion.
- ePRO/eCOA: questionnaire templates, schedules, responses, missing data, abnormal answers.
- Safety: AE/SAE events, investigator judgment, reporting deadlines, follow-up records.
- Risk: risk signals, AI risk outputs, manual disposition, responsibility assignment, closure.
- Drug and sample: shipment, receipt, medication adherence, sample collection, sample transport, cold-chain events.
- Reports: generated drafts, source snapshots, confirmation status, export logs.
- Documents and audit: documents, versions, audit events, export logs, sensitive-data access logs.
- AI platform: model configs, prompt templates, knowledge base records, call logs, output-review queue.
- Notifications and tasks: user tasks, reminders, escalation rules.

### 3.4 Cross-Cutting Rules

- Every AI output must include source data, generated time, prompt/model version, confidence expression, human confirmation state, and audit trail.
- AI must not produce medical finality labels such as "AI diagnosed" or "AI confirmed".
- Every critical operation must produce an audit event.
- Sensitive subject identity data is masked by default and full-view access is audited.
- High-risk operations require confirmation dialogs with required reason fields.
- Risk closure must record actor, role, reason, source risk, before/after state, and timestamp.
- Exports of sensitive data must require confirmation and create export records.
- The UI must keep risk visible without using large aggressive red surfaces.

## 4. Milestone Plan

### M0 - Engineering Contract And Foundations

Goal: turn the UI design book into a technical contract before product code expands.

Duration: 1 week.

Deliverables:

- Repository scaffold and local development scripts.
- Domain glossary.
- Database schema v0.
- API contract v0.
- RBAC matrix.
- Audit event taxonomy.
- AI output lifecycle contract.
- Seed data for one demo study.
- CI checks for lint, typecheck, unit tests, and schema validation.

Exit criteria:

- A new engineer or AI worker can run the project locally from a clean checkout.
- Every planned module has an owner file path and domain boundary.
- All high-risk workflow states have explicit enum values and audit events.

### M1 - Web Shell, Design System, And Dashboard

Goal: productize the supplied Web prototype into maintainable Web shell, reusable components, and the first data-backed dashboard.

Duration: 2 weeks.

Deliverables:

- Login, project selection, global layout, left navigation, top toolbar.
- Component library extracted from `Web后台UI设计/src/app/App.tsx`: buttons, tags, badges, cards, tables, modals, drawers, timeline, loading, empty state, AI card, risk tag, audit trail, progress bar, info row.
- Project dashboard with KPI cards, charts, risk summary, center ranking, subject risk table, and task list.
- Mock-to-seed data wiring through typed API endpoints.

Exit criteria:

- UI matches the design book's information density and visual rules.
- UI remains recognizably aligned with `Web后台UI设计/`.
- Dashboard loads from backend seed data, not hardcoded component literals.
- Components cover all states needed by later modules.

### M2 - Core Clinical Operations

Goal: implement the daily operating workflows for CRC, CRA, PI, and PM users.

Duration: 3 weeks.

Deliverables:

- Subject list and subject detail.
- Consent management.
- Remote visit workstation.
- ePRO/eCOA management.
- Initial task/reminder model.
- Critical confirmation modals and audit logging.

Exit criteria:

- A seeded subject can move through consent, visit tasks, questionnaire completion, and visit submission.
- Critical workflow actions create audit events.
- Permission and masking behavior is visible in UI and tested.

### M3 - Safety, Risk, AI, Reports, And Audit

Goal: implement the product's main differentiation: AI-assisted risk detection with human confirmation and traceable accountability.

Duration: 3 weeks.

Deliverables:

- AI protocol parsing UI and version-effective workflow.
- AE/SAE detail workflow.
- AI risk monitoring dashboard.
- AI platform configuration.
- Report center.
- Documents and audit page.
- Worker jobs for AI mock adapters, risk scoring, report generation, and overdue checks.

Exit criteria:

- Task 3.6 is integrated as a clean, reviewable unit and its RBAC, tests, and API contract agree.
- AI-derived protocol activation, report confirmation, and any other promotion path reject outputs that are not `Adopted` or `EditedAdopted`; purely human-authored records use an explicit non-AI path.
- Every Phase 0-3 list/export endpoint resolves an authorized project scope, every detail/mutation endpoint checks the target object's project, and permissions use the actor's role in that target project.
- Cross-project list, detail, and mutation attempts are covered by negative tests.
- Risk creation, assignment, handling, closure, and audit history are end-to-end testable.
- AE/SAE reporting deadline states are correctly colored and cannot be silently closed.
- Protocol parse-to-review-to-activation and report draft-to-confirmation-to-export have normal HTTP paths and complete audit chains.

### M4 - Subject, Provider, Drug/Sample, And Audit Surfaces

Goal: extend the system beyond the Web back office into subject and service-provider operations.

Duration: 4 weeks.

Delivery order:

1. **M4A - Minimum Subject source-data loop:** identity binding, today's tasks, ePRO, symptom report, Web handling, and audit replay.
2. **M4B - Complete Subject experience:** electronic consent, medication, remote visit, reminders, messages, accessibility, and recovery flows.
3. **M4C - Provider and supply operations:** Provider task views, drug/sample and cold-chain workflows, and any dedicated read-only audit/regulator presentation.

M4A exit criteria:

- A Subject identity can access only its bound subject, tasks, and records; client-supplied project/subject identifiers cannot widen scope.
- A Subject submits ePRO and a symptom report from mobile, with source, identity, version, timestamps, and audit metadata preserved.
- A severe symptom creates a safety-review task or risk signal that CRC/PI handles in Web.
- Web users cannot silently overwrite the original Subject response; corrections and assisted entries remain distinct and attributable.
- The repeatable smoke path is Web task assignment -> Subject submission -> system trigger -> Web handling -> audit replay.

M4B/M4C exit criteria remain governed by the Phase 4 plan and do not block acceptance of M4A.

## 5. AI Worker Execution Model

Use separate AI workers per phase or per module. Each worker must receive:

- The source PDF path.
- The current phase plan.
- The architecture roadmap.
- The AI execution and review protocol.
- The existing repository status.
- A hard instruction not to bypass audit, RBAC, masking, or AI confirmation contracts for speed.

The reviewing architect performs final review after each worker handoff:

- Run project checks.
- Inspect changed files.
- Verify domain boundaries.
- Verify audit and permission behavior.
- Verify UI against the design book.
- Reject hardcoded demo-only shortcuts in product paths.

## 6. Review Gates

### Gate A - Contract Review

Required before large feature implementation:

- Schema review.
- API route review.
- Enum/state-machine review.
- RBAC matrix review.
- Audit taxonomy review.

### Gate B - UI System Review

Required before module pages multiply:

- Component naming and variants.
- Risk colors.
- AI labeling.
- Table density.
- Modal and drawer behavior.
- Responsive constraints.

### Gate C - Workflow Review

Required before user testing:

- Consent lifecycle.
- Visit lifecycle.
- ePRO missing-data lifecycle.
- AE/SAE lifecycle.
- Risk lifecycle.
- Report confirmation lifecycle.

### Gate D - Compliance Review

Required before any real data or client demo:

- Audit completeness.
- Sensitive-data masking.
- Export confirmation and log.
- AI source traceability.
- Medical-safety wording.
- Read-only role immutability.
