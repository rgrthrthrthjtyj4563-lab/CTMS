# Phase 1 Web Shell And Design System Development Plan

## Goal

Productize the supplied `Web后台UI设计/` prototype into the Web back office shell and reusable design system so later modules are consistent, dense enough for B-end clinical operations, and aligned with both the prototype and the PDF design document.

## Scope

This phase implements:

- Login page.
- Project selection page.
- Authenticated app shell.
- Left navigation and top toolbar.
- Core component library.
- Project dashboard.

This phase must not redesign the Web back office from scratch. The baseline is `Web后台UI设计/src/app/App.tsx`.

## Required UI Rules

- Desktop target: 1440 x 1024.
- Minimum Web width: 1280px.
- Top bar: 64px.
- Left navigation: 240px, collapsible to icon mode.
- Main color: `#0B4DA2`, from the Web prototype.
- Sidebar color: `#0A1628`, from the Web prototype.
- Sidebar selected/accent blue: `#3B8BF5`, from the Web prototype.
- AI/accent color: `#6B52D9`, from the Web prototype.
- Risk colors: low `#16A34A`, medium `#D97706`, high `#EA580C`, critical `#DC2626`.
- Background: `#EEF1F7`.
- Cards: white background, 12px radius, light shadow.
- Buttons and inputs: 6px radius.
- Tags: 4px radius.
- Tables: 48px row height, fixed header where useful, hover state, risk left border for important rows.

## Recommended Files To Create Or Modify

- Read-only source reference: `Web后台UI设计/src/app/App.tsx`
- Read-only source reference: `Web后台UI设计/src/styles/theme.css`
- Read-only source reference: `Web后台UI设计/package.json`
- Required reference: `docs/ui/web-prototype-inventory.md`
- `apps/web/app/login/page.tsx`
- `apps/web/app/projects/page.tsx`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/app/(app)/dashboard/page.tsx`
- `apps/web/components/app/AppShell.tsx`
- `apps/web/components/app/TopBar.tsx`
- `apps/web/components/app/SideNav.tsx`
- `apps/web/components/ui/Button.tsx`
- `apps/web/components/ui/Input.tsx`
- `apps/web/components/ui/Select.tsx`
- `apps/web/components/ui/Checkbox.tsx`
- `apps/web/components/ui/Radio.tsx`
- `apps/web/components/ui/Tag.tsx`
- `apps/web/components/ui/Badge.tsx`
- `apps/web/components/ui/Card.tsx`
- `apps/web/components/ui/DataTable.tsx`
- `apps/web/components/ui/Modal.tsx`
- `apps/web/components/ui/Drawer.tsx`
- `apps/web/components/ui/Toast.tsx`
- `apps/web/components/ui/Timeline.tsx`
- `apps/web/components/ui/Tabs.tsx`
- `apps/web/components/ui/Pagination.tsx`
- `apps/web/components/ui/EmptyState.tsx`
- `apps/web/components/ui/LoadingState.tsx`
- `apps/web/components/domain/RiskTag.tsx`
- `apps/web/components/domain/AISuggestionCard.tsx`
- `apps/web/components/domain/KpiCard.tsx`
- `apps/web/lib/api/dashboard.ts`
- `apps/web/tests/dashboard.spec.ts`

If the selected implementation remains Vite/React instead of Next.js, map the same responsibilities to:

- `apps/web/src/app/AppShell.tsx`
- `apps/web/src/routes/LoginPage.tsx`
- `apps/web/src/routes/ProjectSelectionPage.tsx`
- `apps/web/src/routes/DashboardPage.tsx`
- `apps/web/src/components/...`

The architectural requirement is component and route separation; the exact router can follow the final scaffold chosen in Phase 0.

## Implementation Tasks For AI Worker

### Task 1.1 - Build Design Tokens

Deliver:

- Color, spacing, radius, shadow, and typography tokens extracted from `Web后台UI设计/src/styles/theme.css`.
- Tailwind or CSS variable mapping.
- Component stories or preview route for visual inspection.

Acceptance:

- All risk and AI colors are tokenized.
- No page hardcodes incompatible risk colors.
- The token output preserves the prototype's dark sidebar, primary blue, blue-violet AI accent, and light grey page background.

### Task 1.1A - Inventory The Supplied Prototype

Deliver:

- Update `docs/ui/web-prototype-inventory.md` if implementation discovers new prototype facts.
- A production mapping in the worker handoff showing each prototype function's final file path.
- A production mapping in the worker handoff showing each prototype mock array's seed/API destination.
- A production mapping in the worker handoff showing each visual token's final implementation path.

Acceptance:

- Every function from `Web后台UI设计/src/app/App.tsx` has one destination: shared UI primitive, domain component, route page, seed data, or deliberate discard.
- Deliberate discards require a reason.

### Task 1.2 - Build App Shell

Deliver:

- Top toolbar based on the prototype `Topbar`: breadcrumb/project context, global search, notification indicator, user avatar, role context. Add missing project switcher, AI entry, task entry, language/help only if Phase 0 auth/project context supports them.
- Left navigation based on prototype `Sidebar` and `NAV_ITEMS`, with all first-phase Web modules from the PDF.
- Collapsed navigation state.
- Active route state.
- Badge and risk dot support.

Acceptance:

- Dashboard and future pages render inside the same shell.
- Navigation labels match the PDF module names.
- Shell visually matches the supplied prototype unless a documented adjustment is made.

### Task 1.3 - Build Core Components

Deliver:

- Button variants extracted from prototype `Btn`: primary, secondary, danger, AI, ghost, outline, disabled.
- Tags extracted from prototype `RiskBadge`, `AITag`, and `StatusTag`: status, risk, AI, role, visit type, source.
- DataTable with search, filtering hook, sorting hook, selectable rows, pagination, horizontal overflow.
- Card variants extracted from prototype `KPICard`, `RiskCard`, `AISuggestionCard`, and subject-summary patterns.
- Modal variants based on prototype `Modal`: confirm, high-risk confirm, AI confirm, delete confirm, export confirm, protocol activate, close alert, adopt AI note.
- Drawer based on prototype `Drawer`, expanded to 480px and 720px variants where needed.
- Loading, empty, success, and error states.
- `AuditTrail`, `ProgressBar`, and `InfoRow` as shared primitives because the prototype already uses them across clinical pages.

Acceptance:

- Components expose typed props.
- Components are reused in dashboard rather than reimplemented.
- Components are extracted from the prototype instead of visually reinvented.

### Task 1.4 - Build Login And Project Selection

Deliver:

- Login page based on prototype `LoginPage`, including brand panel, account/password, captcha-style field, and second-factor step.
- Project selection page listing available studies and role context.
- Authentication smoke flow using seed users.

Acceptance:

- Login does not look like a public marketing homepage.
- Failed login has clear error state.
- Project selection is required before entering a project-scoped dashboard.

### Task 1.5 - Build Project Dashboard

Deliver:

- KPI cards: total subjects, enrolled, screen failed, enrollment completion, visit completion, ePRO completion, AE count, SAE count, high-risk subject count, pending tasks.
- Trend chart for enrollment or visit completion.
- AI risk summary card.
- Center performance table.
- Subject risk table.
- Pending task list.
- Report export and AI weekly report buttons.

Acceptance:

- Dashboard data loads from API/seed data.
- High-risk rows use tags and left border, not full red rows.
- AI summary includes AI label, source, generated time, and human confirmation state.
- Layout and content density remain close to prototype `DashboardPage`.

## Tests And Verification

Required commands:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- Web smoke test for login -> project selection -> dashboard.
- Visual check at 1440 x 1024 and 1280px minimum width.

## Architect Review Gate

Reject Phase 1 if:

- The dashboard is hardcoded and bypasses seed/API data.
- Components are duplicated per page.
- AI content lacks labels.
- Risk colors diverge from the design book.
- The shell feels like a marketing site instead of an operational B-end system.
- The worker ignores the supplied `Web后台UI设计/` prototype and rebuilds an unrelated interface.
