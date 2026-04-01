/**
 * Lightweight cookie-based session using iron-session.
 *
 * v1: Manual "Your Name" + Role selection stored in encrypted cookie.
 * Future: Replace createSession() with Google Workspace OIDC token exchange
 *         while keeping the same SessionData shape and getSession() API.
 *
 * SECURITY:
 *   - Cookie is encrypted with SESSION_SECRET (32+ chars required)
 *   - httpOnly, sameSite: lax, secure in production
 *   - Sessions expire per SESSION_TTL_SECONDS
 */

import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { Role } from "@/types/rbac";

// ============================================================
// SESSION DATA SHAPE
// ============================================================

export interface SessionData {
  id: string;
  name: string;
  email?: string;       // reserved for future SSO
  role: Role;
  sessionToken: string;
  createdAt: string;    // ISO string
  expiresAt: string;    // ISO string
}

// ============================================================
// IRON SESSION CONFIG
// ============================================================

function getSessionOptions(): SessionOptions {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters long"
    );
  }

  const cookieName =
    process.env.SESSION_COOKIE_NAME ?? "slides_platform_session";
  const ttlSeconds = parseInt(
    process.env.SESSION_TTL_SECONDS ?? "28800",
    10
  );

  return {
    cookieName,
    password: secret,
    ttl: ttlSeconds,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

// ============================================================
// PUBLIC API
// ============================================================

/** Get the current session from the request cookies. Returns null if no valid session. */
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    getSessionOptions()
  );
  return session;
}

/** Get the current user from the session, or null if not authenticated. */
export async function getCurrentUser(): Promise<SessionData | null> {
  const session = await getSession();
  if (!session.id || !session.name) {
    return null;
  }
  return {
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
    sessionToken: session.sessionToken,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

/** Require an authenticated session — throws UnauthorizedError if missing. */
export async function requireSession(): Promise<SessionData> {
  const user = await getCurrentUser();
  if (!user) {
    const { UnauthorizedError } = await import("@/lib/errors");
    throw new UnauthorizedError();
  }
  return user;
}

/** Require a specific role or higher — throws ForbiddenError if insufficient. */
export async function requireRole(minimumRole: Role): Promise<SessionData> {
  const user = await requireSession();
  const roleHierarchy: Record<Role, number> = {
    VIEWER: 0,
    EDITOR: 1,
    ADMIN: 2,
  };

  if (roleHierarchy[user.role] < roleHierarchy[minimumRole]) {
    const { ForbiddenError } = await import("@/lib/errors");
    throw new ForbiddenError(
      `Role "${minimumRole}" or higher required. You have role "${user.role}".`
    );
  }

  return user;
}
