# AI Execution And Architect Review Protocol

## Purpose

This protocol is for downstream AI workers implementing AIC-DCT and for the reviewing architect who performs final acceptance.

The downstream AI executes. The reviewing architect audits correctness, architecture, safety, and consistency with `AIC-DCT UI Design Document.pdf`.

## Required Context For Every Worker

Each worker must receive these files:

- `AIC-DCT UI Design Document.pdf`
- `Web后台UI设计/`
- `docs/ui/web-prototype-inventory.md`
- `docs/architecture/aic-dct-architecture-development-roadmap.md`
- The current phase plan under `docs/development-plans/`
- Any existing API, schema, and component files in the repository after scaffold exists.

## Worker Rules

- Implement only the assigned phase or module.
- Do not rename architecture boundaries without updating the roadmap and the phase plan.
- Do not remove audit events, permission checks, masking, confirmation dialogs, or AI labels to make a demo faster.
- Do not hardcode UI data inside final route components when a backend or seed-data path exists.
- Do not mark AI output as final medical judgment.
- Do not hide unauthorized sensitive data completely when the design requires a permission message.
- Use typed enums for lifecycle states instead of ad hoc strings.
- Add tests for every state transition, permission rule, and audit-producing action.
- For Web back-office work, use `Web后台UI设计/src/app/App.tsx` as the visual and interaction baseline. Extract and productize it; do not invent a new Web UI without recording a specific reason.
- Treat prototype mock arrays as seed-data shape references only. Do not keep final product pages dependent on in-component mock arrays.

## Required Handoff Format

Every worker must end with:

```markdown
## Scope Completed

- [module or phase delivered]

## Files Changed

- `path/to/file`: reason

## How To Run

- `command`

## Verification Performed

- `command`: result

## Known Limits

- [concrete limit, if any]

## Review Focus

- [specific areas the architect should inspect]
```

## Architect Review Checklist

### Repository Health

- Project installs from a clean checkout.
- Local dev server starts.
- Lint passes.
- Typecheck passes.
- Unit tests pass.
- E2E or smoke tests pass for the implemented workflow.

### Architecture

- Module boundaries match the roadmap.
- Shared types are reused instead of duplicated.
- No module imports across boundaries in a way that creates cycles.
- Database schema uses explicit enums for core states.
- API routes match the route naming and authorization pattern already used.

### Clinical Workflow Safety

- Consent, visit, ePRO, AE/SAE, risk, and report records have explicit lifecycle states.
- Critical actions require confirmation.
- Required reason fields are enforced server-side.
- AI outputs require human confirmation before becoming formal records.
- SAE and high-risk closures cannot bypass audit.

### UI

- Web back office uses left nav, top toolbar, and main content layout.
- Web back office remains visually consistent with `Web后台UI设计/`: dark sidebar, compact white topbar, dense cards/tables, prototype token family, and AI/risk visual treatment.
- Risk colors follow green, yellow, orange, red.
- AI content uses blue-purple AI labels.
- Tables support search/filter/sort/pagination where specified.
- Drawers and modals follow the design document's structure.
- No marketing-style landing page replaces the actual product screen.

### Audit And Compliance

- Every critical mutation writes an audit event.
- Audit events include actor, role, project, object, action, before/after where applicable, reason where required, IP/device if available, and timestamp.
- Sensitive identity fields are masked by default.
- Full sensitive-data views are permission-gated and logged.
- Sensitive exports require confirmation and create export records.

## Rejection Criteria

Reject the handoff if any of these are true:

- A critical mutation has no server-side audit event.
- AI output can become final without human confirmation.
- Subject PII is displayed unmasked to ordinary roles.
- A high-risk or SAE closure has no required reason.
- The implementation uses only hardcoded local component data for a page that should exercise backend state.
- Typecheck or tests fail and the failure is inside the worker's changed scope.
- UI breaks the product positioning by becoming a marketing page, ordinary CRM, or consumer health app.
- Web back-office implementation discards the supplied prototype without a documented architecture or usability reason.
