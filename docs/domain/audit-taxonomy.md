# AIC-DCT Audit Event Taxonomy

> Mirrors `packages/domain/src/audit.ts:CRITICAL_AUDIT_PAIRS` and
> `AuditObjectType` / `AuditAction` enums. The Prisma `AuditEvent` model
> stores these fields and is the only authoritative source for compliance
> reporting.

## Schema

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string (cuid) | Primary key. |
| `actorUserId` | string | Required. |
| `actorRole` | string | Required; matches `Role` enum. |
| `projectId` | string | Required; scopes the event to a project. |
| `objectType` | string | One of `AuditObjectType`. |
| `objectId` | string | Required. |
| `action` | string | One of `AuditAction`. |
| `beforeValue` | JSON | Optional. Required for status-change / update actions. |
| `afterValue` | JSON | Optional. Required for status-change / update actions. |
| `reason` | string | Optional. **Required for critical-reason actions** (see matrix). |
| `ipAddress` | string | Optional; populated by request middleware. |
| `userAgent` | string | Optional; populated by request middleware. |
| `device` | string | Optional; populated by request middleware. |
| `requestId` | string | Optional; correlates with API response. |
| `timestamp` | Date | Default `now()`. |

## Object Types (`AuditObjectType`)

Project, ProtocolVersion, Subject, Consent, Visit, QuestionnaireResponse,
SafetyEvent, RiskSignal, DrugShipment, SampleTransfer, ReportDraft,
ExportRecord, Document, AIConfig, AIOutput, User, AuditExport.

## Action Catalogue (`AuditAction`)

`create`, `update`, `delete`, `soft-delete`, `status-change`, `adopt`,
`reject`, `confirm`, `sign`, `submit`, `close`, `reopen`, `view-full-identity`,
`mask-reveal`, `export`, `login`, `logout`, `login-failed`, `role-assigned`,
`role-revoked`, `ai-output-generated`, `ai-output-adopted`,
`ai-output-edited-adopted`, `ai-output-rejected`, `protocol-uploaded`,
`protocol-parsed`, `protocol-activated`, `protocol-superseded`.

## Critical Actions

A critical action is a (objectType, action) tuple in `CRITICAL_AUDIT_PAIRS`.
Critical actions MUST:

1. Pass a server-side `authorize()` permission check.
2. Persist an `AuditEvent` in the same transaction as the mutation.
3. Display a confirmation dialog in the UI before submission.
4. If `requiresReason: true`, reject the request when `reason` is empty.
5. If `requiresConfirmation: true`, the API MAY require an explicit
   `confirmed: true` body field in addition to the dialog (Phase 2 decision).

## Reason-Required Actions

`SafetyEvent.close`, `SafetyEvent.report`, `RiskSignal.close`,
`RiskSignal.reject`, `RiskSignal.reopen`, `ReportDraft.export`,
`Consent.reopen`, `ProtocolVersion.protocol-activated`,
`ProtocolVersion.protocol-superseded`, `AIOutput.ai-output-rejected`,
`Subject.mask-reveal`, `ExportRecord.export`, `AuditExport.export`.

## Sensitive Access

Reading `SubjectSensitiveIdentity` writes a `view-full-identity` audit
event. Removing the masking (e.g. pasting into a report) writes a
`mask-reveal` event with reason.

## Export Records

Every report or data export creates an `ExportRecord` and writes a
`Report.export` or `ExportRecord.export` audit event with reason. The
`objectIds` array captures what was exported for compliance review.

## AI Output Events

Every AI output that is generated, adopted, edited-adopted, or rejected
writes a dedicated audit event. The `auditEventIds` array on `AIOutput`
tracks the chain so that any downstream mutation is traceable back to the
originating model call (whose `inputHash`, `modelVersion`, and prompt
template version are stored on the output itself).