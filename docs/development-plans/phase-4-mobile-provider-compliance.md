# Phase 4 Mobile, Provider, Drug/Sample, And Compliance Development Plan

## Goal

Complete the multi-party DCT operating loop by adding subject mobile flows, provider task views, drug/sample management, and read-only audit/regulator access.

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
- Mobile smoke test: login as subject -> view tasks -> complete medication check-in -> complete ePRO -> submit symptom report.
- Provider smoke test: provider accepts task -> completes task -> reports exception.
- Read-only smoke test: auditor views document and audit log -> mutation is denied.

## Architect Review Gate

Reject Phase 4 if:

- Subject mobile shows Web-back-office complexity or pressure-heavy wording.
- Severe symptom reporting lacks emergency medical guidance.
- Provider users can see unrelated tasks.
- Drug/sample exceptions do not connect to risk monitoring.
- Read-only users can mutate data.
- The Web drug/sample page no longer resembles the supplied prototype without a documented reason.
