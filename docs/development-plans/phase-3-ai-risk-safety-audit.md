# Phase 3 AI Risk, Safety, Reports, And Audit Development Plan

## Goal

Implement the differentiated intelligence layer: AI protocol parsing, safety-event workflow, AI risk monitoring, reports, documents, audit, and AI platform configuration.

> Historical scope note: Tasks 3.1-3.6 describe the original implementation scope. Phase 3 final acceptance also requires Task 3.7 below and the M3 exit criteria in the architecture roadmap.

## Scope

This phase implements:

- AI protocol parsing.
- AE/SAE safety event detail.
- AI risk monitoring dashboard.
- Drug/sample risk hooks needed by risk monitoring.
- Report center.
- Documents and audit page.
- AI platform configuration.
- Worker jobs for parsing, risk detection, report draft generation, overdue checks, and AI call logging.

For Web pages, use `Web后台UI设计/src/app/App.tsx` as the UI baseline. The prototype pages to productize in this phase are `ProtocolPage`, `AESAEPage`, `RiskMonitorPage`, `ReportsPage`, `DocumentsPage`, and `AIConfigPage`.

## Recommended Files To Create Or Modify

- `apps/web/app/(app)/protocol-ai/page.tsx`
- `apps/web/app/(app)/safety/[eventId]/page.tsx`
- `apps/web/app/(app)/risk-monitoring/page.tsx`
- `apps/web/app/(app)/reports/page.tsx`
- `apps/web/app/(app)/documents-audit/page.tsx`
- `apps/web/app/(app)/ai-platform/page.tsx`
- `apps/web/components/protocol/ProtocolParseWorkspace.tsx`
- `apps/web/components/safety/SafetyEventDetail.tsx`
- `apps/web/components/risk/RiskMonitoringDashboard.tsx`
- `apps/web/components/reports/ReportPreview.tsx`
- `apps/web/components/audit/AuditLogTable.tsx`
- `apps/web/components/ai-platform/AICapabilityConfig.tsx`
- `apps/api/src/modules/protocol-ai/`
- `apps/api/src/modules/safety/`
- `apps/api/src/modules/risks/`
- `apps/api/src/modules/reports/`
- `apps/api/src/modules/documents/`
- `apps/api/src/modules/ai-platform/`
- `apps/worker/src/jobs/protocol-parse.job.ts`
- `apps/worker/src/jobs/risk-score.job.ts`
- `apps/worker/src/jobs/report-generate.job.ts`
- `apps/worker/src/jobs/overdue-check.job.ts`
- `apps/web/tests/ai-risk-safety.spec.ts`

## Implementation Tasks For AI Worker

### Task 3.1 - AI Protocol Parsing

Deliver:

- File information area: protocol name, version, upload time, uploader, AI parse status, human confirmation status.
- Left document outline/source preview.
- Right AI parsed results.
- Tabs: project summary, inclusion criteria, exclusion criteria, visit plan, visit tasks, time windows, remote/site recommendation, safety risk points, data collection fields.
- Criteria table: number, type, original text, structured result, confidence, confirmation state, action.
- Source-evidence drawer.
- Edit and single-item confirmation.
- "Confirm all and make effective" modal with required confirmation note.
- Preserve the prototype's tabbed protocol parsing layout, AI parsing banner, inclusion/exclusion presentation, visit-plan cards, remote/site visit labels, and protocol activation modal pattern.

Acceptance:

- Effective protocol version is immutable after activation.
- New activation supersedes previous effective version.
- Activation creates audit event and version record.
- AI parse result has model, prompt version, source file, confidence expression, and human confirmation state.

### Task 3.2 - AE/SAE Safety Event Detail

Deliver:

- Event summary: event ID, subject number, event type, state, severity, SAE flag, report state, responsible investigator, reporting countdown.
- Event information form.
- AI risk prompt and reporting-deadline panel.
- Investigator judgment fields: AE, SAE, severity, drug relationship, action taken, outcome, continue medication, medical judgment note, investigator signature.
- Follow-up records.
- Audit log.
- Preserve the prototype's SAE deadline banner, right-side AI risk prompt, investigator judgment panel, follow-up records, and audit trail.

Acceptance:

- Potential SAE state shows countdown.
- Closing high-risk or SAE event requires reason and investigator authority.
- SAE reporting-deadline colors follow: more than 24h yellow, within 24h orange, overdue red.
- AI prompt cannot set final SAE judgment without investigator confirmation.

### Task 3.3 - AI Risk Monitoring Dashboard

Deliver:

- Risk overview cards: total risks, high risk, critical risk, handled, pending, overdue.
- Risk-level distribution chart.
- Site risk ranking.
- Subject risk list.
- Data-quality risk section.
- Compliance risk section.
- Drug/sample risk section.
- Risk handling closed-loop section.
- Risk detail drawer with source, trigger rule, related data, AI analysis, recommended action, processing history, audit record, action buttons.
- Preserve the prototype's risk overview cards, trend chart, center ranking, risk table, and drawer interaction.

Acceptance:

- Risk table fields match the PDF: risk number, level, type, object, trigger reason, AI recommended action, owner, deadline, handling status, action.
- Risk closure writes audit and requires reason for high/critical risks.
- Risk ownership and status changes are tested.

### Task 3.4 - Report Center

Deliver:

- Report type filter.
- Report list/cards with name, type, time range, generation time, generation method, source data, human confirmation state, export state, actions.
- Report preview page with directory, body, source data, and confirmation record.
- AI generated-draft warning.
- Export confirmation and export record.
- Preserve the prototype's report-card layout with AI draft state, data source line, human-confirmation action, and export action.

Acceptance:

- Reports are generated from a captured source-data snapshot.
- Exporting sensitive report data requires confirmation and audit.
- Report cannot be marked official without authorized human confirmation.

### Task 3.5 - Documents And Audit

Deliver:

- Document category tree.
- Document list.
- Version records.
- Audit log table with fields: operation time, actor, role, object, operation type, before value, after value, IP, device, reason.
- Export center.
- Preserve the prototype's tabbed document/audit layout, category cards, AI output records tab, and audit warning pattern.

Acceptance:

- Audit filters by actor, object, action, date, project, and subject where applicable.
- Read-only audit roles cannot mutate documents or audit records.

### Task 3.6 - AI Platform Configuration

Deliver:

- AI capability overview.
- Knowledge-base management.
- Prompt templates.
- Model configuration.
- AI output review queue.
- AI call logs.
- Risk rules.
- Preserve the prototype's capability list, model labels, monthly call counts, capability toggles, and risk-rule table pattern.

Acceptance:

- AI call logs include time, module, caller, project, input summary, output summary, model name, prompt version, human confirmation state, and action.
- Prompt template changes create versioned records and audit events.

### Task 3.7 - Compliance, Promotion, And Project-Isolation Closure

Deliver:

- Move target-project role resolution into the shared authorization layer.
- Apply `resolveProjectScope` to every Phase 0-3 list, aggregate, and export endpoint that accepts or derives project scope.
- Load the target object's `projectId` and enforce project access on every detail and mutation endpoint.
- Evaluate permissions against the actor's assignment in the target project, not a primary/default role from another project.
- Require `canPromoteAIOutput` at every AI-to-formal-record boundary, including AI-derived protocol activation and report confirmation.
- Provide a normal Parsed -> UnderReview -> Effective HTTP path for protocol versions.
- Align PII reveal behavior, RBAC code, domain tests, this matrix, and OpenAPI descriptions.

Acceptance:

- Unassigned `?projectId=` access returns `403`; foreign object IDs cannot be read or mutated.
- A high-privilege role in project A grants no authority in project B unless the actor has that role assignment in B.
- `Pending`, `Rejected`, and `NeedsInvestigatorConfirmation` AI outputs cannot be promoted; `Adopted` and `EditedAdopted` can be promoted when project, kind, target, and version match.
- Human-authored protocol/report paths do not create a fake AI output and are explicitly distinguished from AI-derived paths.
- Negative authorization and promotion tests cover subjects, consent, visits, ePRO, safety, risks, protocol, reports, documents, audit, and AI configuration.

## Tests And Verification

Required commands:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- Worker job tests with deterministic mock AI provider.
- E2E smoke: protocol parse -> effective version -> risk generation -> risk handling -> report draft -> export.
- Permission tests for PI-only SAE judgment and audit read-only role.
- Cross-project list/detail/mutation tests and target-project role tests.
- AI promotion tests at protocol activation and report confirmation, not only at adopt/reject endpoints.

## Architect Review Gate

Reject Phase 3 if:

- AI output can bypass human confirmation.
- Any Phase 0-3 route trusts an unverified `projectId`, exposes a foreign-project object, or evaluates authority using the wrong project's role.
- Protocol activation mutates previous effective versions.
- SAE closure lacks reason, authority, or audit.
- Report export lacks confirmation and export log.
- AI call logs omit model or prompt version.
- The Web pages discard the supplied prototype's safety/risk/report interaction model without a documented reason.
