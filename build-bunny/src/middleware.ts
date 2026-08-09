import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

/**
 * Middleware is OPTIMISTIC ONLY (plan §4): locale negotiation and prefix
 * routing. Authoritative auth/RBAC/tenancy live in layout guards,
 * getSessionContext, and the permission-wrapped data layer — never here.
 */
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
