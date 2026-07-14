# Phase 3 Closure And Subject Source-Data Decision

Status: Accepted  
Date: 2026-07-14

## Decision

AIC-DCT will use a sequentially overlapped delivery path:

1. Close Phase 3 compliance and isolation gaps first.
2. Immediately follow with a Phase 4A minimum Subject data loop.
3. Defer the broader Subject experience, Provider surfaces, and drug/sample operations to later Phase 4 slices.

This is not two full workstreams running against a moving authorization contract. Low-coupling mobile UI preparation may overlap Phase 3 closure, but Subject write APIs start only after the shared project/role guards are stable.

## Product Contract

Subject-reported source data is created by an authenticated `Subject` identity uniquely bound to one subject record. The Web back office configures, monitors, queries, confirms, and handles that data; it must not silently create, modify, or overwrite a Subject's original response.

Where an approved workflow permits staff-assisted entry, the system creates a distinct `AssistedEntry` record and permanently preserves:

- the original information provider;
- the staff recorder;
- the reason and collection channel;
- the entry time and applicable instrument/version;
- the original value, corrections, and complete audit history.

Assisted entry remains visibly labelled in UI, statistics, exports, and audit records. It is never represented as Subject self-entry. Ordinary CRC assistance cannot create the identity fact that a Subject personally signed informed consent.

## Phase 3 Exit Decision

Phase 3 is not complete merely because the Web pages and route happy paths exist. It is complete only when:

- Task 3.6 is integrated as a clean, reviewable unit;
- every Phase 0-3 list/export endpoint resolves an authorized project scope;
- every detail/mutation endpoint checks the target object's project;
- permissions are evaluated using the actor's role in the target project;
- AI-derived protocol activation and report confirmation reject outputs that are not `Adopted` or `EditedAdopted`;
- protocol, report, risk, safety, PII, export, and audit paths have negative authorization tests and traceable audit chains.

## Phase 4 Slicing Decision

### Phase 4A - Minimum Subject Source-Data Loop

- Subject identity binding and self-only access.
- Today's tasks.
- ePRO draft and submission.
- Symptom report with urgent-care guidance.
- Severe symptom creates a safety-review task or risk signal.
- Web monitoring/handling without overwriting the original response.
- End-to-end audit replay.

### Phase 4B - Complete Subject Experience

- Electronic consent and re-consent.
- Medication check-in.
- Remote-visit entry.
- Reminders, messages, accessibility, and recovery flows.

### Phase 4C - Provider And Supply Operations

- Provider task surfaces.
- Drug, sample, logistics, and cold-chain workflows.
- Dedicated regulator/auditor presentation where the existing read-only Web surface is insufficient.

## Explicit Non-Goals For The Next 2-4 Weeks

- Real model-provider integration.
- BullMQ/Redis or microservice extraction.
- Production OIDC, e-signature vendor, video vendor, or object-storage integration.
- Provider, drug/sample, cold-chain, chat, voice input, or rich upload flows.
- Re-labelling seed or Web-entered data as Subject-originated data.

## Consequences

The next release first proves that the system is trustworthy, then proves that it is a DCT product. Historical phase documents remain historical records; their acceptance baseline is supplemented by this decision, the M3 exit criteria, and Task 3.7.
