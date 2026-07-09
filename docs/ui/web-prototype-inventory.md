# Web Back Office Prototype Inventory

Source: `Web后台UI设计/`, reviewed on 2026-07-09.

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

