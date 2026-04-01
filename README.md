# Slides Platform

A Next.js 14 full-stack application for generating Google Slides presentations from customer data with full audit trails and role-based access control.

## Quick Start

```bash
# 1. Copy environment file and fill in values
cp .env.example .env.local

# 2. Start Postgres
docker compose up -d

# 3. Install dependencies
pnpm install

# 4. Generate Prisma client + push schema
pnpm db:generate
pnpm db:push

# 5. Seed development data
pnpm db:seed

# 6. Start the dev server
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
slides-platform/
├── app/                      # Next.js App Router
│   ├── (auth)/login/         # Login page
│   ├── (dashboard)/          # Authenticated layout
│   │   ├── dashboard/        # Overview & stats
│   │   ├── templates/        # Template list
│   │   ├── generate/         # Start generation
│   │   ├── runs/             # Run history
│   │   └── settings/         # Provider config (ADMIN)
│   └── api/                  # API routes
│       ├── auth/             # Login / logout
│       ├── generate/         # Start generation
│       └── health/           # DB health check
├── components/               # React components
│   ├── ui/                   # shadcn/ui primitives
│   ├── nav/                  # Sidebar, Header
│   ├── auth/                 # LoginForm
│   └── generate/             # GenerateForm
├── lib/                      # Pure utilities
│   ├── session.ts            # iron-session helpers + RBAC
│   ├── errors.ts             # Typed error classes
│   ├── ids.ts                # ID generators
│   ├── logger.ts             # pino structured logger
│   └── cn.ts                 # Tailwind class merger
├── providers/                # External provider adapters
│   ├── data/                 # mock | databricks | rest
│   └── llm/                  # stub | openai
├── services/                 # Business logic
│   ├── template.service.ts
│   ├── generation.service.ts
│   └── audit.service.ts
├── types/                    # TypeScript domain types
├── validations/              # Zod schemas
├── server/db.ts              # Prisma client singleton
├── middleware.ts             # Auth + RBAC enforcement
└── prisma/
    ├── schema.prisma         # Full DB schema
    └── seed.ts               # Dev seed data
```

## Roles

| Role    | Capabilities                                      |
|---------|---------------------------------------------------|
| ADMIN   | Full access including Settings and provider config |
| EDITOR  | Generate decks, manage templates                  |
| VIEWER  | Read-only access to runs and templates            |

## Development

See [docs/local-development.md](docs/local-development.md) for full setup instructions.

## Architecture

See [docs/architecture.md](docs/architecture.md) for system design documentation.

## Security

See [docs/security.md](docs/security.md) for the security model.

## Phase Roadmap

- **Phase 1** ✅ — Scaffolding, session management, RBAC, Prisma schema, UI framework
- **Phase 2** 🔜 — Template import, field scanning, condition builder
- **Phase 3** 🔜 — Databricks SQL, REST API, and OpenAI provider implementations
- **Phase 4** 🔜 — Full generation pipeline with Google Slides API integration
- **Phase 5** 🔜 — Tests, hardening, audit slide, documentation
