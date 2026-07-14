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
- **Subject-Reported Source Data**: data reported by a Subject and created through an authenticated Subject identity uniquely bound to that subject record. A Web screen or seed fixture is not evidence of Subject origin.
- **Assisted Entry**: an approved exception in which staff records information provided by a Subject. It preserves the provider, recorder, reason, channel, time, instrument/version, corrections, and audit history, and is never labelled or counted as Subject self-entry.
- **Correction**: an append-only attributed amendment to submitted source data. It preserves the original value, corrected value, actor, reason, and timestamp; it is not an in-place overwrite.
- **AI Promotion**: the server-side transition by which an AI-derived suggestion becomes or is referenced by a formal operational/clinical record. Promotion requires `canPromoteAIOutput()` plus matching project, output kind, target object, and version. Purely human-authored records use a separate non-AI path.
- **Target-Project Role**: the actor's role assignment in the project that owns the queried or mutated object. Authorization never borrows authority from the actor's role in another project.
