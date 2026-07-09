# AIC-DCT Domain Glossary

> Phase 0 reference. New terms added here MUST be reused across the API,
> schema, and UI; do not invent synonyms.

## Roles

| Role | Description |
| --- | --- |
| SponsorAdmin | Sponsor portfolio owner. Full read on study, masked PII only by default. |
| CROPM | CRO project manager. Day-to-day operations lead. |
| SitePI | Principal investigator at a site. PI-grade authority. |
| SiteCRC | Clinical research coordinator at a site. Operational executor. |
| CRA | Clinical research associate. Monitoring + source data verification. |
| Auditor | Internal/external auditor. Read-only across all data + audit. |
| RegulatorReadOnly | Ethics committee / regulator. Read-only. |
| Subject | Patient enrolled in the trial. Subject-mobile-only role. |
| ProviderLogistics | Logistics provider (drug transport). |
| ProviderNurse | Home-nurse / sample-collection provider. |
| SystemAdmin | Platform administrator. |

## Lifecycle Enums

See `@aic-dct/domain/enums.ts`. Each enum maps 1:1 to a Prisma enum in `apps/api/prisma/schema.prisma`.

- **ProtocolParseStatus**: Uploaded → Parsing → Parsed → ParseFailed / UnderReview → Effective → Superseded.
- **HumanConfirmationStatus**: Pending → (Adopted | EditedAdopted | Rejected | NeedsInvestigatorConfirmation). Adopted/EditedAdopted/Rejected are terminal.
- **SubjectStatus**: PreScreening → Consenting → Screening → Enrolled → Active → (Completed | Withdrawn | ScreenFailed). Completed/Withdrawn/ScreenFailed are terminal.
- **VisitStatus**: NotStarted → Scheduled → InProgress → SubmittedForPI → Completed. Side branches: Missed, OutOfWindow, Deviation.
- **ConsentStatus**: NotStarted → Reading → ComprehensionPending → SubjectSigned → InvestigatorSigned → Completed. Side branches: ReConsentRequired, Withdrawn.
- **QuestionnaireStatus**: Scheduled → InProgress → Submitted → Reviewed. Side branches: Missed, Late.
- **SafetyEventStatus**: Draft → InvestigatorReview → (ConfirmedAE | ConfirmedSAE) → Reported → FollowUp → Closed. **Closed requires a reason.**
- **RiskLevel**: Low / Medium / High / Critical.
- **RiskStatus**: Open → Assigned → InProgress → PendingInvestigator → Resolved → Closed. Side branch: Rejected. **Closed requires a reason.**
- **ReportStatus**: Generating → Draft → UnderReview → Confirmed → Exported. Failed is a recovery branch.

## Cross-cutting Concepts

- **AI Output Lifecycle**: every AI output is born `Pending` and may be `Adopted` or `EditedAdopted` by a human. Only Adopted/EditedAdopted outputs may be referenced by downstream workflows, and only with their AI label still attached. AI never produces medical finality.
- **Critical Action**: any (objectType, action) pair listed in `audit.ts:CRITICAL_AUDIT_PAIRS`. Critical actions require server-side authorization, an audit event, and confirmation in the UI. Some critical actions (e.g. SAE Close, Risk Close) also require a non-empty reason.
- **Masked Identity**: site-side identifier visible to ordinary roles. `SubjectSensitiveIdentity` is only returned after the caller passes `Permission.SubjectReadFull` AND writes a `view-full-identity` audit event.
- **Read-Only Role**: Auditor and RegulatorReadOnly. They may read sensitive data but every mutation request is rejected with `403 FORBIDDEN`.