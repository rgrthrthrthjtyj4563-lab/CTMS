# Phase 2 Core Clinical Workflows Development Plan

## Goal

Implement the daily clinical-operation workflows used by CRC, CRA, PI, PM, and site staff.

## Scope

This phase implements:

- Subject list.
- Subject detail.
- Electronic informed consent management.
- Remote visit workstation.
- ePRO/eCOA management.
- Workflow tasks and reminders needed by these pages.

For Web pages, use `Web后台UI设计/src/app/App.tsx` as the UI baseline. The prototype pages to productize in this phase are `SubjectsPage`, `SubjectDetailPage`, `EConsentPage`, `RemoteVisitPage`, and `EPROPage`.

## Recommended Files To Create Or Modify

- `apps/web/app/(app)/subjects/page.tsx`
- `apps/web/app/(app)/subjects/[subjectId]/page.tsx`
- `apps/web/app/(app)/consent/page.tsx`
- `apps/web/app/(app)/visits/remote/[visitId]/page.tsx`
- `apps/web/app/(app)/epro/page.tsx`
- `apps/web/components/subjects/SubjectTable.tsx`
- `apps/web/components/subjects/SubjectSummaryCard.tsx`
- `apps/web/components/subjects/VisitTimeline.tsx`
- `apps/web/components/consent/ConsentVersionPanel.tsx`
- `apps/web/components/consent/ConsentSigningTable.tsx`
- `apps/web/components/visits/RemoteVisitWorkspace.tsx`
- `apps/web/components/epro/QuestionnaireRecordTable.tsx`
- `apps/api/src/modules/subjects/`
- `apps/api/src/modules/consent/`
- `apps/api/src/modules/visits/`
- `apps/api/src/modules/epro/`
- `apps/api/src/modules/tasks/`
- `apps/api/src/modules/audit/`
- `apps/web/tests/core-workflows.spec.ts`

## Implementation Tasks For AI Worker

### Task 2.1 - Subject List

Deliver:

- Filters: project, site, subject status, risk level, current visit, out-of-window, AE presence, investigator-confirmation pending, subject number search.
- Status summary cards.
- Table fields: subject number, site, status, current visit, visit window, consent status, ePRO completion, AE/SAE, AI risk score, responsible CRC, pending tasks, actions.
- Row actions: view detail, start visit, send reminder, view risk, add AE, view logs.
- Preserve the prototype's compact subject table structure, status summary cards, progress bars, risk score cell, and row-click detail navigation.

Acceptance:

- Filters are reflected in API query parameters.
- Table supports pagination and horizontal scroll.
- Subject identity fields are masked unless authorized.

### Task 2.2 - Subject Detail

Deliver:

- Subject summary card.
- Visit timeline with states: completed, in progress, not started, out of window, deviation, remote visit, site visit.
- Right-side AI risk card and pending task list.
- Tabs: basic info, visit records, consent, ePRO questionnaire, medication records, AE/SAE, uploaded files, AI risk, audit log.
- Preserve the prototype's top subject header, KPI row, AI risk card, tabbed detail panel, masked contact display, and audit tab pattern.

Acceptance:

- Opening full identity information requires permission and writes an audit event.
- AI risk card includes reasons, recommended actions, source data, and confirmation state.

### Task 2.3 - Consent Management

Deliver:

- ICF version management panel.
- Signing progress metrics.
- Subject signing table.
- AI plain-language explanation card.
- Re-consent task section.
- Confirmation modal for publishing a consent file.
- Preserve the prototype's ICF current-version KPI cards, signing table, AI plain-language card, and version-history panel.

Acceptance:

- Consent lifecycle state changes are server-side validated.
- Publishing a new ICF version creates audit events and re-consent tasks where applicable.
- AI explanation is clearly marked as auxiliary and not a replacement for the official consent document.

### Task 2.4 - Remote Visit Workstation

Deliver:

- Three-column layout:
  - Left: subject info and visit task checklist.
  - Middle: video area, questionnaire results, vital signs, uploaded files, historical visit comparison.
  - Right: AI visit outline, AI visit note draft, risk prompt.
- Footer actions: save draft, generate AI note, submit for investigator confirmation, complete visit, create AE, view audit record.
- AI note adoption modal with AI original text, source basis, human edit area, and confirmation checkbox.
- Preserve the prototype's three-column remote visit workspace: 240px subject/task column, flexible video/data center, and 280px AI assistant panel. Adjust widths only if usability testing or responsive constraints require it.

Acceptance:

- Visit note cannot be completed without required tasks.
- AI note cannot become formal record without human adoption.
- Visit submission creates audit event and task for investigator confirmation.

### Task 2.5 - ePRO/eCOA Management

Deliver:

- Metrics: expected submissions, submitted, missing, late, abnormal answers, high-risk questionnaires.
- Questionnaire template list.
- Response table: subject number, questionnaire, visit, push time, fill time, status, abnormal answer, AI risk prompt, action.
- AI abnormal-answer card.
- Preserve the prototype's KPI cards, abnormal-analysis card, and questionnaire table.

Acceptance:

- Missing and late status derive from schedule and submitted time.
- Abnormal-answer AI output shows label, source, recommendation, and human status.

## Tests And Verification

Required commands:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- E2E smoke: login -> subject list -> subject detail -> consent -> remote visit -> ePRO.
- API tests for permission denial, audit creation, and invalid state transitions.

## Architect Review Gate

Reject Phase 2 if:

- Critical state transitions happen only in UI with no server validation.
- Consent publication, visit submission, or AI note adoption lacks audit.
- The remote visit page treats AI notes as final records.
- Sensitive subject fields are unmasked for ordinary roles.
- The Web workflow pages no longer resemble the supplied prototype without a documented reason.
