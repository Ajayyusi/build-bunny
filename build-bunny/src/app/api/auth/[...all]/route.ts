import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

/**
 * Better Auth catch-all endpoint: sign-in (email + username), sign-out,
 * session, change-password, admin (ban/revoke/impersonate) — all framework
 * routes live under /api/auth/*.
 */
export const { GET, POST } = toNextJsHandler(auth);
