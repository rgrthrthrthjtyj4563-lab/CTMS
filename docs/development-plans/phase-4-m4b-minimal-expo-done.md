# M4B Minimal Expo — Done

Status: **Done** (2026-07-14)  
Follows: Assisted Entry (`1af9bfe`)

## Three pages

| Screen | Route | API |
|--------|-------|-----|
| 今日任务 | `app/(tabs)/tasks.tsx` | `GET /api/subject/me`, `my-tasks` |
| ePRO 填写 | `app/epro/[responseId].tsx` | Subject ePRO save/submit |
| 症状上报 | `app/(tabs)/symptom.tsx` | `POST /api/subject/symptom-reports` |

## Run

```bash
# Terminal 1 — API
npm run dev --workspace=apps/api

# Terminal 2 — Expo
npm run dev --workspace=apps/mobile
# Physical device: EXPO_PUBLIC_API_URL=http://<your-lan-ip>:4000 npm run dev --workspace=apps/mobile
```

Login: `subject-a@aic-dct.test` / `1234` (Subject role only).

## Data origin UX

- App copy states **Subject 通道** on login, tasks, symptom submit
- Tasks distinguish `SubjectSelfReport` vs `AssistedEntry` labels
- Web CRC 代录 remains separate (amber); App submissions are green path

## Not in slice

Full M4B (notifications, offline, medication, remote visit), consent in App, production OIDC.