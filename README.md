# AIC-DCT — Remote Intelligent Clinical Trial Operating System

> Phase 0 foundation. This phase builds the engineering contract, data model,
> RBAC, audit, AI output lifecycle, seed, and API contract that every later
> feature depends on. It does **not** build product UI pages.

## Workspace Layout

```
.
├── apps/
│   ├── api/        # TypeScript Fastify backend (Phase 0: route skeletons + error envelope)
│   ├── web/        # Web back office (Phase 0: stub; Phase 1 productizes Web后台UI设计/)
│   └── worker/     # Background jobs (Phase 0: stub; Phase 3 wires BullMQ)
├── packages/
│   └── domain/     # Shared enums, zod schemas, RBAC, audit, AI lifecycle
├── docs/
│   ├── api/openapi.yaml
│   ├── architecture/...
│   ├── development-plans/...
│   ├── domain/...           # Phase 0 deliverables
│   └── ui/...
└── Web后台UI设计/    # UNTOUCHED — visual + interaction baseline
```

## Phase 0 Deliverables

| Deliverable | Location |
| --- | --- |
| Enums & zod schemas | `packages/domain/src/enums.ts`, `schemas.ts` |
| RBAC matrix + helper | `packages/domain/src/rbac.ts` + tests |
| Audit taxonomy + helper | `packages/domain/src/audit.ts` + tests |
| AI output lifecycle | `packages/domain/src/ai.ts` + tests |
| API error envelope | `packages/domain/src/errors.ts` + tests |
| Prisma schema v0 | `apps/api/prisma/schema.prisma` |
| Seed demo study | `apps/api/prisma/seed.ts` |
| API server skeleton | `apps/api/src/server.ts` + route modules |
| OpenAPI contract | `docs/api/openapi.yaml` |
| Glossary | `docs/domain/glossary.md` |
| RBAC matrix doc | `docs/domain/rbac-matrix.md` |
| Audit taxonomy doc | `docs/domain/audit-taxonomy.md` |
| AI lifecycle doc | `docs/domain/ai-output-lifecycle.md` |

## Quick Start

```bash
npm install
npm run typecheck
npm run test
```

Phase 0 deliberately does not require a running PostgreSQL/Redis. The API
server boots in offline mode; the `db:generate / db:migrate / db:seed`
scripts are wired but require `DATABASE_URL` to actually run migrations.

## Phase 1 Preview

Phase 1 productizes `Web后台UI设计/src/app/App.tsx` into:

- `apps/web/src/app/{pages,components,layout}` — extracted from the prototype.
- Typed API client (`apps/web/src/api/*`) backed by the contracts in
  `docs/api/openapi.yaml`.
- Dashboard wired to the seed dataset via `/api/projects/:id/dashboard`.

No marketing redesign. No new visual language. The prototype's token family
in `Web后台UI设计/src/styles/theme.css` remains the source of truth.