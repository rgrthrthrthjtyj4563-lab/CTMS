# Phase 4A (M4A) Done Report

Status: **Strategic Done** (2026-07-14)  
Baseline commit: `b8777b1` (+ hardening follow-up)

## Delivered

| # | Acceptance item | Evidence |
|---|-----------------|----------|
| 1 | Subject identity bound to exactly one subject (`subjectUserId`) | `schema.prisma`, `resolveSubjectIdentity` in `auth.ts`, seed `subject-a/b` |
| 2 | Subject portal APIs: me, my-tasks, ePRO draft/submit, symptom report | `apps/api/src/routes/subject-portal.ts` |
| 3 | Self-only isolation; forged subjectId/projectId cannot widen scope | `m4a-subject-portal.test.ts` |
| 4 | `SubjectSelfReport` entry channel on Subject-originated ePRO | `DataEntryChannel` enum + portal writes |
| 5 | Web monitors without mutating Subject-original payloads | `epro.ts` staff guards + `EproPage.tsx` read-only UX |
| 6 | Severe symptom → risk signal + safety draft + audit (transactional) | `subject-portal.ts` `$transaction` |
| 7 | Demo Subject users + mobile CLI smoke harness | `seed.ts`, `apps/mobile/src/smoke.ts` |

## Smoke path

1. Seed DB (`npm run db:seed`)
2. CRC logs into Web → ePRO page sees **受试者源数据** rows
3. Subject actor (`subject-a@aic-dct.test`) via `/api/subject/*` or `apps/mobile` smoke submits ePRO / symptom
4. CRC handles risk on Web; auditor replays audit trail

## Known limits (explicit non-goals for M4A)

- **No Expo / native App UI** — only API + CLI smoke; full mobile UX is M4B
- **No Assisted Entry** — CRC cannot legitimately record on behalf of Subject yet; staff `StaffEntry` remains separate from App origin
- **Historical seed ePRO rows are `StaffEntry`** — not App source data; only rows created via Subject portal or the seeded Scheduled Subject task count as App channel
- **Dev auth only** (`X-Actor-Id` / mock login); no production OIDC
- **Phase 3 debt untouched**: partial R1 on documents/subjects writes, PII matrix drift, weak phase-3 closure assertions

## Next (pick one; do not parallelize)

1. **Assisted Entry minimum slice** (recommended) — distinct record, permanent label, strong audit; never `SubjectSelfReport`
2. **M4B minimal Expo** — three pages: today’s tasks / ePRO / symptom report

Do **not** start M4C (Provider, drug/sample, cold chain, regulator surfaces), real LLM, or BullMQ under M4A/M4B unless explicitly approved.