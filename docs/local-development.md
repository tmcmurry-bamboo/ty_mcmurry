# Local Development

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Docker Desktop** (for Postgres)
- A `.env.local` file (copy from `.env.example`)

## First-Time Setup

```bash
# 1. Clone and enter the project
git clone <repo-url> slides-platform
cd slides-platform

# 2. Copy environment file
cp .env.example .env.local
# Edit .env.local — at minimum set SESSION_SECRET (32+ random chars)
# DATABASE_URL is pre-configured for the Docker Postgres instance

# 3. Start Postgres
docker compose up -d

# 4. Install dependencies
pnpm install

# 5. Generate Prisma client
pnpm db:generate

# 6. Push schema to DB (dev — no migration file)
pnpm db:push

# 7. Seed development data
pnpm db:seed

# 8. Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`.

## Daily Dev Workflow

```bash
# Start Postgres (if not running)
docker compose up -d

# Start dev server
pnpm dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Postgres connection string |
| `SESSION_SECRET` | ✅ | Min 32-char secret for iron-session cookie encryption |
| `SESSION_MAX_AGE_SECONDS` | Optional | Session TTL (default: 28800 = 8 hours) |
| `DATABRICKS_TOKEN` | Phase 3 | Databricks personal access token |
| `REST_API_KEY` | Phase 3 | REST data source API key |
| `OPENAI_API_KEY` | Phase 3 | OpenAI API key |

## pnpm Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start Next.js dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Regenerate Prisma client after schema changes |
| `pnpm db:push` | Push schema to DB (dev only — no migration) |
| `pnpm db:migrate` | Run Prisma migrations (production) |
| `pnpm db:seed` | Seed development data |
| `pnpm db:studio` | Open Prisma Studio GUI |
| `pnpm test` | Run Jest tests |
| `pnpm test:watch` | Run Jest in watch mode |

## Prisma Schema Changes

After editing `prisma/schema.prisma`:

```bash
# Regenerate client types
pnpm db:generate

# Push to dev DB (no migration file)
pnpm db:push

# Or create a proper migration
pnpm db:migrate
```

## Adding a New Data Provider

1. Create `providers/data/my-provider.ts` implementing `DataSourceProvider`
2. Add the provider type to `prisma/schema.prisma` `DataProviderType` enum
3. Register it in `providers/data/index.ts` switch statement
4. Add a `ProviderConfig` row via Prisma Studio or seed

## Adding a New LLM Provider

1. Create `providers/llm/my-llm.ts` implementing `LlmProvider`
2. Add the provider type to `prisma/schema.prisma` `LlmProviderType` enum
3. Register it in `providers/llm/index.ts` switch statement
4. Add a `LlmProviderConfig` row via Prisma Studio or seed

## Troubleshooting

**"Cannot connect to database"**
- Check `docker compose ps` — Postgres container must be running
- Verify `DATABASE_URL` in `.env.local`

**"Session secret too short"**
- `SESSION_SECRET` must be at least 32 characters
- Generate one: `openssl rand -base64 32`

**TypeScript errors on first clone**
- Run `pnpm install` then `pnpm db:generate`
- Most errors are pre-install artifacts that clear after install
