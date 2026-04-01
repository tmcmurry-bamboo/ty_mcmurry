# Architecture

## Overview

Slides Platform is a Next.js 14 App Router application. It uses server components for data fetching, API routes for mutations, and client components only where interactivity is required.

```
Browser ──► Next.js App Router
              │
              ├─ Server Components (RSC) ── Prisma ──► Postgres
              ├─ API Routes ────────────── Services ──► Prisma
              └─ Client Components (CSR) ── fetch() ──► API Routes
```

## Key Layers

### `app/` — Pages & API Routes
- `(auth)/` — login page (unauthenticated)
- `(dashboard)/` — authenticated layout with Sidebar + Header; redirects to `/login` if no session
- `api/auth/` — login/logout cookie management via iron-session
- `api/generate` — triggers generation pipeline
- `api/health` — DB connectivity check (used by load balancers)

### `middleware.ts` — Auth + RBAC
- Runs on every matched request before the page renders
- Reads iron-session cookie → validates session exists in DB
- Enforces per-route role requirements (ADMIN, EDITOR, VIEWER)
- Redirects unauthenticated requests to `/login`

### `services/` — Business Logic
| File | Responsibility |
|------|---------------|
| `template.service.ts` | Template & field CRUD, import |
| `generation.service.ts` | Full pipeline orchestration |
| `audit.service.ts` | Immutable audit trail writes |

### `providers/` — External Adapters
All external systems are accessed through typed interfaces:

**Data Source Providers** (`DataSourceProvider`)
- `MockDataProvider` — fixture data, always available
- `DatabricksProvider` — stub (Phase 3)
- `RestApiProvider` — HTTP fetch implementation (Phase 3)

**LLM Providers** (`LlmProvider`)
- `StubLlmProvider` — deterministic responses, always available
- `OpenAiProvider` — stub (Phase 3)

Provider resolution is dynamic: the active provider is read from `ProviderConfig` in Postgres, defaulting to Mock/Stub. Adding a new provider requires only implementing the interface and registering it in the `index.ts` registry — no changes to business logic.

### `lib/` — Pure Utilities
- **`session.ts`** — iron-session cookie helpers, `getCurrentUser()`, `requireRole()`
- **`errors.ts`** — typed error hierarchy (`ValidationError`, `NotFoundError`, `ProviderError`, etc.)
- **`ids.ts`** — `generateId()`, `generateRunId()`, `generateCorrelationId()`
- **`logger.ts`** — pino structured logger with correlation ID support
- **`cn.ts`** — Tailwind `clsx` + `tailwind-merge` helper

## Data Model (Prisma)

```
UserSession ──┐
              ├──► GenerationRun ──► GenerationFieldValue
Template ─────┘                 └──► AuditEntry
  └──► TemplateField
  └──► TemplateCondition
  └──► ObjectTag

ProviderConfig (data sources)
LlmProviderConfig
```

## Generation Pipeline

```
POST /api/generate
  │
  ├─ 1. PENDING   → create GenerationRun
  ├─ 2. FETCHING  → call DataSourceProvider.getCompanyPreview()
  ├─ 3. PREVIEW   → persist GenerationFieldValues, return preview to UI
  │                 (user may edit individual fields here)
  ├─ 4. GENERATING→ apply replacements in Google Slides copy
  └─ 5. COMPLETED → write audit slide, update run status
```

Every state transition writes an `AuditEntry`. Field edits in PREVIEW state also write an entry with `before`/`after` values.

## Session Management

Sessions use **iron-session** — an encrypted, signed cookie stored client-side. The server never stores the session data in memory. The cookie contains: `{ sessionToken, userId, name, role }`.

On every authenticated request, middleware validates the `sessionToken` against `UserSession` in Postgres (checking `expiresAt`). Logout destroys the cookie and marks the DB session expired.

This design allows a future swap to Google Workspace OIDC by replacing session creation in `POST /api/auth/login` and `middleware.ts` only.
