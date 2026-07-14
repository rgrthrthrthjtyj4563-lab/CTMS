# AIC-DCT RBAC Matrix (Phase 0)

> Single source of truth for role → permission. The matrix below is mirrored
> in `packages/domain/src/rbac.ts:ROLE_PERMISSIONS`; tests in
> `packages/domain/src/rbac.test.ts` enforce the contract.

Legend:

- ✅ = permission granted
- ⛔ = permission explicitly denied
- _(blank)_ = not applicable for this role

| Permission | Sponsor | CRO PM | Site PI | Site CRC | CRA | Auditor | Regulator | Subject | Logistics | Nurse | System |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| project:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  | ✅ | ✅ | ✅ |
| project:create | ✅ |  |  |  |  |  |  |  |  |  | ✅ |
| project:update | ✅ | ✅ |  |  |  |  |  |  |  |  | ✅ |
| project:archive | ✅ |  |  |  |  |  |  |  |  |  | ✅ |
| protocol:parse |  |  |  |  |  |  |  |  |  |  | ✅ |
| protocol:activate | ✅ | ✅ |  |  |  |  |  |  |  |  | ✅ |
| subject:list | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  |  | ✅ | ✅ |
| subject:read.masked | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  | ✅ | ✅ |
| subject:read.full | ✅ | ✅ | ✅ |  | ✅ | ✅ | ✅ |  |  |  | ✅ |
| subject:create |  |  | ✅ | ✅ |  |  |  |  |  |  | ✅ |
| subject:update.status |  |  | ✅ | ✅ |  |  |  |  |  |  | ✅ |
| subject:withdraw |  |  | ✅ |  |  |  |  |  |  |  | ✅ |
| subject:tasks.read |  |  |  |  |  |  |  | ✅ |  |  | ✅ |
| consent:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  |  | ✅ |
| consent:sign |  |  | ✅ | ✅ |  |  |  | ✅ |  |  | ✅ |
| consent:re-consent |  |  | ✅ |  |  |  |  |  |  |  | ✅ |
| visit:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  |  | ✅ | ✅ |
| visit:create |  |  | ✅ | ✅ |  |  |  |  |  |  | ✅ |
| visit:update |  |  | ✅ | ✅ |  |  |  |  |  |  | ✅ |
| visit:submit |  |  | ✅ | ✅ |  |  |  |  |  |  | ✅ |
| visit:close |  |  | ✅ |  |  |  |  |  |  |  | ✅ |
| questionnaire:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  |  | ✅ |
| questionnaire:submit |  |  |  | ✅ |  |  |  | ✅ |  |  | ✅ |
| symptom:report |  |  |  |  |  |  |  | ✅ |  |  | ✅ |
| questionnaire:review |  |  | ✅ |  |  |  |  |  |  |  | ✅ |
| safety:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  |  |  | ✅ |
| safety:draft |  |  | ✅ | ✅ |  |  |  |  |  | ✅ | ✅ |
| safety:confirm |  |  | ✅ |  |  |  |  |  |  |  | ✅ |
| safety:report |  |  | ✅ |  |  |  |  |  |  |  | ✅ |
| safety:close |  |  | ✅ |  |  |  |  |  |  |  | ✅ |
| risk:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  |  |  | ✅ |
| risk:assign | ✅ | ✅ | ✅ |  |  |  |  |  |  |  | ✅ |
| risk:resolve | ✅ | ✅ | ✅ |  |  |  |  |  |  |  | ✅ |
| risk:close |  | ✅ |  |  |  |  |  |  |  |  | ✅ |
| drug:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  | ✅ |  | ✅ |
| drug:dispatch |  |  | ✅ |  |  |  |  |  | ✅ |  | ✅ |
| drug:receive |  |  |  |  |  |  |  |  | ✅ |  | ✅ |
| sample:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  | ✅ | ✅ | ✅ |
| sample:collect |  |  |  |  |  |  |  |  |  | ✅ | ✅ |
| sample:transfer |  |  |  |  |  |  |  |  | ✅ |  | ✅ |
| report:read | ✅ | ✅ | ✅ |  | ✅ | ✅ | ✅ |  |  |  | ✅ |
| report:generate | ✅ | ✅ |  |  |  |  |  |  |  |  | ✅ |
| report:confirm | ✅ | ✅ |  |  |  |  |  |  |  |  | ✅ |
| report:export | ✅ | ✅ |  |  |  |  |  |  |  |  | ✅ |
| document:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  |  | ✅ | ✅ |
| document:upload | ✅ | ✅ | ✅ |  |  |  |  |  |  |  | ✅ |
| document:version | ✅ | ✅ | ✅ |  |  |  |  |  |  |  | ✅ |
| ai:config.read | ✅ | ✅ |  |  |  | ✅ |  |  |  |  | ✅ |
| ai:config.update | ✅ | ✅ |  |  |  |  |  |  |  |  | ✅ |
| ai:output.read | ✅ | ✅ | ✅ | ✅ |  | ✅ | ✅ |  |  |  | ✅ |
| ai:output.adopt | ✅ | ✅ | ✅ |  |  |  |  |  |  |  | ✅ |
| ai:output.reject | ✅ | ✅ | ✅ |  |  |  |  |  |  |  | ✅ |
| audit:read | ✅ | ✅ | ✅ |  | ✅ | ✅ | ✅ |  |  |  | ✅ |
| audit:export | ✅ |  |  |  |  | ✅ |  |  |  |  | ✅ |
| user:manage | ✅ |  |  |  |  |  |  |  |  |  | ✅ |
| settings:read | ✅ |  |  |  |  |  |  |  |  |  | ✅ |
| settings:update |  |  |  |  |  |  |  |  |  |  | ✅ |

## Read-Only Role Invariant

`Auditor` and `RegulatorReadOnly` MUST NOT hold any mutation permission.
Every API route that performs a write MUST call `assertCanMutate(role)` and
reject the request with `403 FORBIDDEN` when the role is read-only. This is
enforced by the unit tests in `packages/domain/src/rbac.test.ts`.

## Project And Self-Scope Invariants

Permission names do not grant global scope:

- List, aggregate, and export routes MUST resolve an authorized project scope.
- Detail and mutation routes MUST verify the project that owns the target object.
- Permission evaluation MUST use the actor's role assignment in that target project; authority from project A does not carry into project B.
- `Subject` permissions are additionally self-scoped to the subject record bound to the authenticated identity. A Subject route MUST NOT trust a client-supplied `subjectId` or `projectId` to widen scope.
- Provider permissions are additionally assignment-scoped to tasks assigned to that Provider identity.

`questionnaire:submit` for Site CRC describes an approved staff workflow; it MUST NOT be represented as Subject self-entry. When assisted entry is implemented, its distinct permission and audit contract MUST be added to `packages/domain/src/rbac.ts`, domain tests, this matrix, and OpenAPI in the same change. `consent:sign` does not allow a Site CRC to create a Subject's personal signature; signer identity and consent-state transitions remain server-enforced.

## Sensitive PII Access

Viewing the full `SubjectSensitiveIdentity` requires `subject:read.full`.
The endpoint MUST write a `view-full-identity` audit event regardless of
whether the data is returned. This is the Phase 0 contract; Phase 2 wires
the field-level enforcement into the API.

## Required Reason

For the actions listed in `audit.ts:CRITICAL_AUDIT_PAIRS` with
`requiresReason: true`, the API MUST reject requests missing a non-empty
`reason`. The exact list (Phase 0):

- `SafetyEvent.close`
- `SafetyEvent.report`
- `RiskSignal.close`
- `RiskSignal.reject`
- `RiskSignal.reopen`
- `ReportDraft.export`
- `Consent.reopen`
- `ProtocolVersion.protocol-activated`
- `ProtocolVersion.protocol-superseded`
- `AIOutput.ai-output-rejected`
- `Subject.mask-reveal`
- `ExportRecord.export`
- `AuditExport.export`
