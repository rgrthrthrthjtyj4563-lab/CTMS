# Web Back Office Prototype Inventory

Source: `Web后台UI设计/`, reviewed on 2026-07-09.

> Phase 1 production mapping appended 2026-07-09. See section 9 for the
> final destination of every prototype function, mock array, and visual
> token in the Vite/React + React-Router v6 + shadcn-style build that lands
> under `apps/web/`.

## 1. What This Directory Is

`Web后台UI设计/` is a runnable Figma Make code bundle for the Web back-office UI. It should be treated as the primary Web visual and interaction baseline.

Important files:

- `Web后台UI设计/src/app/App.tsx`: consolidated React prototype with pages, components, mock data, modals, drawer, and app shell.
- `Web后台UI设计/src/styles/theme.css`: custom product tokens.
- `Web后台UI设计/src/app/components/ui/`: shadcn/Radix-style component bundle generated with the prototype.
- `Web后台UI设计/package.json`: Vite/React dependency reference.
- `Web后台UI设计/src/imports/AIC-DCT_UI_Design_Document.pdf`: imported copy of the design PDF.

## 2. Technology Signals

The prototype uses:

- Vite 6.
- React.
- Tailwind CSS 4.
- shadcn/Radix primitives.
- lucide-react icons.
- Recharts.
- sonner, vaul, react-day-picker, react-hook-form, and other UI dependencies.

Implementation decision:

- The final Web app can be Vite/React or Next.js, but it must preserve the prototype's visual system and interaction patterns unless a documented product or architecture reason overrides them.
- If using Next.js, migrate the prototype deliberately. Do not visually rewrite it from scratch.

## 3. Token Baseline

Use these prototype tokens for Web implementation:

| Purpose | Value |
| --- | --- |
| Font size base | `14px` |
| Font family | `DM Sans`, system-ui, sans-serif |
| Monospace | `JetBrains Mono`, monospace |
| Page background | `#EEF1F7` |
| Foreground | `#0D1B2A` |
| Card | `#FFFFFF` |
| Primary | `#0B4DA2` |
| Secondary background | `#E6EDF9` |
| Muted foreground | `#64748B` |
| AI/accent | `#6B52D9` |
| Critical/destructive | `#DC2626` |
| Sidebar | `#0A1628` |
| Sidebar selected blue | `#3B8BF5` |
| Radius | `0.5rem` |

Risk colors from `App.tsx`:

| Risk | Background | Text | Border/Dot |
| --- | --- | --- | --- |
| Low | `#F0FDF4` | `#16A34A` | `#86EFAC` / `#16A34A` |
| Medium | `#FFFBEB` | `#D97706` | `#FDE68A` / `#D97706` |
| High | `#FFF7ED` | `#EA580C` | `#FCD9A8` / `#EA580C` |
| Critical | `#FEF2F2` | `#DC2626` | `#FCA5A5` / `#DC2626` |

## 4. Prototype Mock Data To Convert Into Seeds/API

| Prototype constant | Meaning | Production destination |
| --- | --- | --- |
| `SUBJECTS` | Subject list, statuses, sites, ICF status, ePRO rate, AE count, AI risk, CRC owner, tasks | `prisma/seed.ts`, subject API, dashboard API |
| `RISK_ITEMS` | Risk list with level, type, object, trigger, AI suggestion, owner, deadline, status | risk API, risk seed, risk worker fixtures |
| `ENROLLMENT_DATA` | Enrollment trend chart | dashboard API |
| `RISK_TREND` | Risk trend stacked chart | risk monitoring API |
| `CENTER_RISK` | Center risk ranking | dashboard API, risk monitoring API |
| `AUDIT_LOGS` | Audit trail display examples | audit seed, audit API |

Rule: these arrays are shape references, not final in-component data.

## 5. Component Extraction Map

| Prototype function | Production role |
| --- | --- |
| `Btn` | shared UI button with variants: primary, secondary, danger, AI, ghost, outline |
| `RiskBadge` | domain risk tag |
| `AITag` | domain AI label |
| `StatusTag` | shared/domain status tag |
| `KPICard` | dashboard/domain KPI card |
| `RiskCard` | risk summary card |
| `AISuggestionCard` | AI output card with source, action, and confirmation state |
| `SectionHeader` | shared section header |
| `AuditTrail` | audit log preview/list component |
| `EmptyState` | shared empty state |
| `Tabs` | shared tabs |
| `DataTable` | shared table foundation; must gain filtering, sorting, pagination, and typed columns |
| `ProgressBar` | shared progress indicator |
| `InfoRow` | shared key-value row |
| `Modal` | modal variants: confirm, high-risk confirm, AI confirm, delete confirm, export confirm, protocol activate, close alert, adopt AI note |
| `Drawer` | side drawer; add width variants for 480px and 720px |
| `Sidebar` | app side navigation |
| `Topbar` | app top toolbar |
| `MainLayout` | authenticated app shell |

## 6. Page Extraction Map

| Prototype page | Production destination |
| --- | --- |
| `LoginPage` | login route |
| `DashboardPage` | project dashboard route |
| `ProtocolPage` | AI protocol parsing route |
| `SubjectsPage` | subject list route |
| `SubjectDetailPage` | subject detail route |
| `RemoteVisitPage` | remote visit workstation route |
| `AESAEPage` | AE/SAE safety event detail route |
| `RiskMonitorPage` | AI risk monitoring route |
| `EConsentPage` | electronic consent management route |
| `EPROPage` | ePRO/eCOA management route |
| `DrugsPage` | drug and sample management route |
| `ReportsPage` | report center route |
| `DocumentsPage` | documents and audit route |
| `AIConfigPage` | AI platform configuration route |
| `SettingsPage` | system settings route |

## 7. Architecture Adjustments Required During Productization

The prototype is useful but not production architecture. Workers must fix these while preserving the UI:

- Split the 2200+ line `App.tsx` into route pages, domain components, shared primitives, data adapters, and testable modules.
- Replace local page routing state with the selected production router.
- Replace local mock data with typed API calls and seeded backend data.
- Move critical workflow decisions to server-side domain services.
- Add server-side validation for required reason fields in high-risk operations.
- Add persistent audit events for critical actions.
- Add RBAC and masking checks before rendering sensitive subject data.
- Add AI output lifecycle states and prompt/model/source logging.
- Add loading, error, empty, and unauthorized states to every route.
- Add tests around state transitions, permissions, and audit events.

## 8. Review Rule

When reviewing Web implementation, compare against this prototype first. A change is acceptable only if it:

- Improves maintainability while preserving visual behavior.
- Connects mock data to real API/domain state.
- Fixes accessibility, responsiveness, or clinical-safety issues.
- Reconciles a conflict with the PDF design document or compliance contract.

Unexplained visual rewrites should be rejected.

## 9. Phase 1 Production Mapping

Phase 1 ships the Web shell as a Vite/React/TypeScript SPA under `apps/web/`
with React Router v6, Tailwind 4, and shadcn-style components. Routes are
file-per-page; domain components are split from the shared UI library.
Mock arrays from `App.tsx` are replaced with API/seed data; visual tokens
are CSS variables on `:root` mirroring `Web后台UI设计/src/styles/theme.css`.

### 9.1 Visual tokens (CSS variables)

| Token | Final path |
| --- | --- |
| Color, spacing, radius, shadow, typography | `apps/web/src/styles/tokens.css` (`:root` block mirroring prototype) |
| Tailwind 4 theme bridge | `apps/web/src/styles/index.css` (`@theme inline` mirroring prototype) |
| Page background, foreground, sidebar, primary, AI accent, risk | `apps/web/src/styles/tokens.css` |
| Component class utilities | `apps/web/src/lib/cn.ts` (clsx + tailwind-merge) |

### 9.2 Shared UI primitives

| Prototype function | Production path |
| --- | --- |
| `Btn` | `apps/web/src/components/ui/Button.tsx` |
| `RiskBadge` | `apps/web/src/components/domain/RiskTag.tsx` |
| `AITag` | `apps/web/src/components/domain/AITag.tsx` |
| `StatusTag` | `apps/web/src/components/ui/Tag.tsx` |
| `KPICard` | `apps/web/src/components/domain/KpiCard.tsx` |
| `RiskCard` | `apps/web/src/components/domain/RiskCard.tsx` |
| `AISuggestionCard` | `apps/web/src/components/domain/AISuggestionCard.tsx` |
| `SectionHeader` | `apps/web/src/components/ui/SectionHeader.tsx` |
| `AuditTrail` | `apps/web/src/components/ui/AuditTrail.tsx` |
| `EmptyState` | `apps/web/src/components/ui/EmptyState.tsx` |
| `Tabs` | `apps/web/src/components/ui/Tabs.tsx` |
| `DataTable` | `apps/web/src/components/ui/DataTable.tsx` |
| `ProgressBar` | `apps/web/src/components/ui/ProgressBar.tsx` |
| `InfoRow` | `apps/web/src/components/ui/InfoRow.tsx` |
| `Modal` (confirm/high-risk/AI/delete/export/protocol-activate/close-alert/adopt-ai-note) | `apps/web/src/components/ui/Modal.tsx` (variant prop) |
| `Drawer` (480/720 variants) | `apps/web/src/components/ui/Drawer.tsx` |
| `Sidebar` | `apps/web/src/components/app/SideNav.tsx` |
| `Topbar` | `apps/web/src/components/app/TopBar.tsx` |
| `MainLayout` | `apps/web/src/components/app/AppShell.tsx` |

Additional primitives the plan requires but the prototype omitted:

| Concern | Production path |
| --- | --- |
| Plain `Input` / `Select` / `Checkbox` / `Radio` / `Badge` / `Card` / `Toast` / `Pagination` / `LoadingState` | `apps/web/src/components/ui/<Name>.tsx` |
| Toast host (sonner) | `apps/web/src/components/ui/Toaster.tsx` |

### 9.3 Pages

| Prototype page | Production route / path |
| --- | --- |
| `LoginPage` | `apps/web/src/routes/LoginPage.tsx` (`/login`) |
| (no prototype — plan Task 1.4) | `apps/web/src/routes/ProjectSelectionPage.tsx` (`/projects`) |
| `DashboardPage` | `apps/web/src/routes/DashboardPage.tsx` (`/app/dashboard`) |
| `ProtocolPage` (Phase 3) | placeholder route (NavLink still rendered) |
| `SubjectsPage` / `SubjectDetailPage` (Phase 2) | placeholder route |
| `RemoteVisitPage` (Phase 2) | placeholder route |
| `AESAEPage` (Phase 2) | placeholder route |
| `RiskMonitorPage` (Phase 3) | placeholder route |
| `EConsentPage` (Phase 2) | placeholder route |
| `EPROPage` (Phase 2) | placeholder route |
| `DrugsPage` (Phase 2) | placeholder route |
| `ReportsPage` (Phase 3) | placeholder route |
| `DocumentsPage` (Phase 2) | placeholder route |
| `AIConfigPage` (Phase 3) | placeholder route |
| `SettingsPage` (Phase 4) | placeholder route |

### 9.4 Mock arrays → API/seed

| Prototype constant | Production destination |
| --- | --- |
| `SUBJECTS` | `GET /api/dashboard/high-risk-subjects` (Prisma `subject.findMany` filtered by AI risk score) |
| `RISK_ITEMS` | `GET /api/dashboard/risks` (Prisma `riskSignal.findMany` joined with subject) |
| `ENROLLMENT_DATA` | `GET /api/dashboard/enrollment-trend` (Prisma aggregate by month) |
| `RISK_TREND` | `GET /api/dashboard/risk-trend` (Prisma aggregate by month) |
| `CENTER_RISK` | `GET /api/dashboard/center-risk` (Prisma group by site) |
| `AUDIT_LOGS` | `GET /api/audit/events` (already enumerated in Phase 0; first 5 surfaced) |

### 9.5 Login & session (mock auth)

- `POST /api/auth/login` accepts `{ email, password }`; rejects with
  401 unless `email` matches a seed user and `password.length >= 4`. Returns
  `{ user, role, projectId }`.
- `apps/web` stores the result in `localStorage` under
  `aic-dct.session` and renders `ProjectSelectionPage` when projects
  exist, otherwise `DashboardPage`.
- No real OIDC; the JWT secret is unused this phase.

### 9.6 Deliberate discards

- The prototype's `LoginPage` `captcha` block (random 4-char string) is
  discarded: Phase 1 has no real captcha service; the field stays in the UI
  as a decorative placeholder.
- The prototype's `2fa` step is replaced with a single-step mock login.
- The prototype's hard-coded `王医生 (PI)` is replaced with the logged-in
  user's display name from the seed.

