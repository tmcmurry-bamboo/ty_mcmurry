# Security Model

## Authentication

- **Session cookie** — encrypted + signed via `iron-session` (`SESSION_SECRET` env var, min 32 chars)
- Cookie name: `slides_platform_session`; flags: `HttpOnly`, `SameSite=Lax`, `Secure` in production
- Sessions expire after 8 hours (configurable via `SESSION_MAX_AGE_SECONDS`)
- Every request validates `sessionToken` against `UserSession.expiresAt` in Postgres
- Logout destroys the cookie AND sets `UserSession.expiresAt = now()` in DB (prevents token reuse)

## Authorization (RBAC)

Three roles, enforced in both `middleware.ts` (edge) and individual server components/API routes:

| Role   | Routes Accessible |
|--------|-------------------|
| VIEWER | `/dashboard`, `/runs`, `/templates` (read only) |
| EDITOR | All VIEWER routes + `/generate`, template actions |
| ADMIN  | All routes + `/settings`, provider config |

`requireRole(minRole)` in `lib/session.ts` uses a numeric hierarchy: VIEWER=0, EDITOR=1, ADMIN=2. A higher role always satisfies lower requirements.

## Sensitive Data Handling

- **Provider credentials** (Databricks token, REST API key, OpenAI key) are **never stored in plaintext**
  - `ProviderConfig.config` stores a reference to an environment variable name (e.g. `"DATABRICKS_TOKEN"`)
  - The actual secret is read from `process.env` at runtime only
  - Never logged, never returned in API responses
- **IP addresses** in `AuditEntry.ipAddress` are hashed/masked before storage — raw IPs are never persisted
- **Session tokens** in cookies are encrypted; the raw token is never logged

## Input Validation

- All API route inputs validated with **Zod** schemas (`validations/`)
- Zod `safeParse` used everywhere — invalid inputs return 400 with structured error details, never throw unhandled
- DB IDs validated before DB queries to prevent unnecessary DB load

## Error Handling

- `AppError` subclasses distinguish operational from programming errors
- `toUserMessage()` returns safe, client-facing text — internal details (stack traces, DB errors) are never sent to clients
- All API routes use `toErrorResponse()` to normalize error shapes
- Unexpected errors logged server-side with full context; client receives generic "unexpected error" message

## Audit Trail

- Every field edit, run state transition, and provider config change writes an `AuditEntry`
- `AuditEntry` has `before`/`after` JSON blobs and a mandatory `reason` for field edits
- Audit entries are **append-only** — no delete or update operations on `AuditEntry`
- The final generated deck includes a hidden audit slide with field provenance

## Future: Google Workspace OIDC

The session layer is designed to be replaced:
- Swap `POST /api/auth/login` body validation for a Google OIDC token exchange
- `UserSession` creation logic remains identical
- `middleware.ts` session validation is unchanged
- No RBAC or business logic changes required
