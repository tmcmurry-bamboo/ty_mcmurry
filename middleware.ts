/**
 * Next.js Edge Middleware.
 *
 * Responsibilities:
 *   1. Attach correlation ID to every request (X-Correlation-ID header)
 *   2. Auth gate — redirect unauthenticated users to /login
 *   3. Role-based route protection stubs
 *
 * SECURITY: This runs before any page/route handler, so auth checks here
 * are a first line of defense. Server-side permission checks in route
 * handlers and server actions are still required (defense in depth).
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// Routes that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
];

// Routes that skip middleware entirely (static assets, etc.)
const SKIP_PREFIXES = ["/_next", "/favicon.ico", "/images", "/icons"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets
  if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Attach correlation ID to every request
  const correlationId =
    request.headers.get("x-correlation-id") ?? `corr_${uuidv4()}`;

  const response = NextResponse.next();
  response.headers.set("X-Correlation-ID", correlationId);

  // Allow public paths without auth check
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p))) {
    return response;
  }

  // Check for session cookie
  const sessionCookie =
    request.cookies.get(
      process.env.SESSION_COOKIE_NAME ?? "slides_platform_session"
    );

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
