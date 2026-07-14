# Assisted Entry Minimum Slice — Done

Status: **Done** (2026-07-14)  
Follows: M4A (`3497d98`)

## Scope

CRC on-behalf-of-subject ePRO via distinct `AssistedEntry` records. Never `SubjectSelfReport`. No consent surrogate signing.

## Delivered

- `AssistedEntry` + `AssistedEntryCorrection` models and migration
- Permission `questionnaire:assisted-entry` (SiteCRC); `questionnaire:submit` removed from CRC
- API: start / save / submit / correct / get under `/api/epro/assisted-entries/*`
- CRC blocked from staff `/api/epro/responses` write paths
- Web: **CRC 代录** flow with reason + collection channel + permanent UI label
- Audit: create/submit/correct require reason (critical pairs)

## Demo

1. Login `crc-pek@aic-dct.test`
2. ePRO → **CRC 代录** → fill reason + channel → save → submit
3. List shows **· CRC 代录** (amber); detail shows recorder, reason, corrections count
4. Contrast with **· 受试者源数据** (green) from Subject channel

## Not in this slice

- Assisted symptom report
- Expo UI
- Consent assisted entry (explicitly forbidden)