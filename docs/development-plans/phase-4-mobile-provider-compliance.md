# Phase 4 Mobile, Provider, Drug/Sample, And Compliance Development Plan

## Goal

Complete the multi-party DCT operating loop by adding subject mobile flows, provider task views, drug/sample management, and read-only audit/regulator access.

## Delivery Order

Phase 4 is a program, not one indivisible implementation batch:

1. **Phase 4A - Minimum Subject source-data loop** is the next executable slice.
2. **Phase 4B - Complete Subject experience** follows after 4A acceptance.
3. **Phase 4C - Provider and supply operations** follows after the Subject boundary is stable.

Do not begin Subject write APIs until Phase 3 Task 3.7 has stabilized the shared project/role guards. Low-coupling mobile shell and interaction preparation may overlap.

### Source-Data Rule

Subject-reported source data is created by an authenticated Subject identity bound to one subject record. Web may monitor, query, confirm, and handle it, but cannot silently create, alter, or overwrite the original response. Approved assisted entry is stored as a distinct, permanently labelled and audited record; it is not Subject self-entry. Ordinary CRC assistance cannot create a Subject consent signature.

## Scope

This phase implements:

- Drug and sample management in Web back office.
- Subject mobile app.
- Provider logistics, sample collection, and home nurse task views.
- Audit/regulator/ethics read-only views.
- Final compliance smoke checks.

For the Web back-office drug/sample page, use `Web后台UI设计/src/app/App.tsx` `DrugsPage` as the UI baseline. The supplied prototype does not include subject mobile or provider views, so those should follow the PDF design document and the shared Web/mobile domain contracts.

## Recommended Files To Create Or Modify

- `apps/web/app/(app)/drug-sample/page.tsx`
- `apps/mobile/app/home.tsx`
- `apps/mobile/app/tasks.tsx`
- `apps/mobile/app/consent.tsx`
- `apps/mobile/app/epro/[questionnaireId].tsx`
- `apps/mobile/app/remote-visit/[visitId].tsx`
- `apps/mobile/app/symptom-report.tsx`
- `apps/mobile/app/medication-checkin.tsx`
- `apps/web/app/(provider)/logistics/page.tsx`
- `apps/web/app/(provider)/sample-collection/page.tsx`
- `apps/web/app/(provider)/home-nurse/page.tsx`
- `apps/web/app/(readonly)/audit/page.tsx`
- `apps/api/src/modules/drug-sample/`
- `apps/api/src/modules/mobile-subject/`
- `apps/api/src/modules/provider-tasks/`
- `apps/web/tests/mobile-provider-compliance.spec.ts`

## Implementation Tasks For AI Worker

### Phase 4A - Minimum Subject Source-Data Loop

Deliver first:

- Subject authentication context with exactly one bound subject and project; mobile APIs derive scope from identity instead of trusting client-supplied `subjectId` or `projectId`.
- Today's tasks page.
- ePRO draft and submit flow.
- Symptom report with urgent-care guidance.
- Severe symptom creates a safety-review task or risk signal visible in Web.
- Web monitoring/handling that cannot overwrite the original Subject response.
- End-to-end audit replay.

Acceptance:

- Subject A cannot list, read, draft, submit, or infer Subject B's tasks or records.
- At least one ePRO and one symptom report preserve origin, identity, instrument/version, timestamps, and audit metadata.
- Draft and submitted states are distinct; submitted source data is immutable except through an attributed correction.
- The repeatable smoke path is Web task assignment -> Subject submission -> system trigger -> Web handling -> audit replay.

The following original tasks are retained as the Phase 4 program backlog. Task 4.2 and the ePRO/symptom subset of Task 4.4 are delivered by 4A; consent, medication, remote visit, Provider, drug/sample, and dedicated read-only surfaces belong to 4B/4C unless a later decision changes the order.

### Task 4.1 - Drug And Sample Management

Deliver:

- Drug shipment status section.
- Sample transfer status section.
- Exception task list.
- Medication adherence dashboard.
- Cold-chain exception records.
- Drug shipment table: shipment ID, subject number, drug name, batch number, quantity, shipment state, cold-chain state, receipt state, estimated arrival, exception prompt, action.
- Sample transfer table: sample ID, subject number, visit, sample type, collection time, transport state, receipt time, overdue state, test result, action.
- Preserve the prototype's drug/sample KPI row, drug-shipment status panel, sample-management panel, cold-chain exception emphasis, and compact operational layout.

Acceptance:

- Cold-chain exceptions and overdue transfers generate risk signals.
- Receipt and exception handling actions write audit events.

### Task 4.2 - Subject Mobile Home And Tasks

Deliver:

- Subject home with trial name, today's tasks, next visit time, medication reminder, questionnaire reminder, symptom report entry, contact CRC, messages.
- My tasks page grouped by overdue, today, upcoming, completed.
- Clear, low-pressure, subject-friendly wording.

Acceptance:

- Mobile task status matches backend task state.
- Subject cannot see other subjects' data.

### Task 4.3 - Mobile Electronic Consent

Deliver:

- Segmented reading.
- Progress bar.
- Key risk prompt.
- AI plain-language explanation.
- One-click question.
- Contact investigator.
- Comprehension test.
- Electronic signature entry.

Acceptance:

- AI explanation is auxiliary.
- Signature completion creates consent state transition and audit event.
- Failed comprehension test keeps consent incomplete.

### Task 4.4 - Mobile ePRO, Medication, And Symptom Report

Deliver:

- ePRO one-question-per-screen or grouped form.
- Save draft.
- Voice-input affordance if supported by stack.
- Submit confirmation.
- Medication check-in flow.
- Symptom report fields: discomfort type, start time, severity, medical visit, hospitalization, stopped medication, text description, image/report upload, emergency contact prompt.
- Emergency warning when hospitalization, emergency care, or severe discomfort is selected.

Acceptance:

- Symptom report with severe flags creates safety review task and risk signal.
- Draft and submit states are distinct.
- Emergency warning text states that system reporting does not replace urgent medical care.

### Task 4.5 - Provider Task Views

Deliver:

- Logistics task page.
- Sample collection task page.
- Home nurse task page.
- Provider task state transitions: assigned, accepted, in progress, completed, exception reported, cancelled.

Acceptance:

- Provider users can only see assigned tasks.
- Exception reports create risk signals and audit events.

### Task 4.6 - Read-Only Audit And Regulator Views

Deliver:

- Audit read-only page.
- Regulator/ethics read-only project view.
- Document and audit inspection flows.

Acceptance:

- Read-only users cannot mutate any business record.
- Attempted mutation returns authorization error and audit/security log if supported.

## Tests And Verification

Required commands:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- Phase 4A smoke test: Web assigns task -> Subject views own tasks -> saves and submits ePRO -> submits severe symptom -> Web handles generated safety/risk item -> auditor replays the trail.
- Subject isolation tests: forged project/subject/object identifiers never widen access.
- Assisted-entry tests, when that exception is implemented: source, recorder, reason, channel, timestamps, correction history, and persistent labelling are mandatory.
- Phase 4B mobile smoke test: login as subject -> complete medication check-in -> complete ePRO -> submit symptom report.
- Provider smoke test: provider accepts task -> completes task -> reports exception.
- Read-only smoke test: auditor views document and audit log -> mutation is denied.

## Architect Review Gate

Reject Phase 4 if:

- Subject mobile shows Web-back-office complexity or pressure-heavy wording.
- A Subject route trusts client-supplied project/subject scope or exposes another Subject's data.
- Web can silently overwrite Subject-originated source data or assisted entry is represented as Subject self-entry.
- Severe symptom reporting lacks emergency medical guidance.
- Provider users can see unrelated tasks.
- Drug/sample exceptions do not connect to risk monitoring.
- Read-only users can mutate data.
- The Web drug/sample page no longer resembles the supplied prototype without a documented reason.
