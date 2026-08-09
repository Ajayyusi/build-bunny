"use client";

import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  inferAdditionalFields,
  usernameClient,
} from "better-auth/client/plugins";

import type { auth } from "@/lib/auth";

/**
 * Client-side Better Auth. Sign-in flows:
 *  - staff:    authClient.signIn.email({ email, password })
 *  - student:  authClient.signIn.username({ username: `${schoolCode}__${username}`, password })
 * Sign-out, change-password and (platform) admin operations also route through here.
 */
export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    adminClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});
