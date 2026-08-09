import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";

import { db } from "@/lib/db";
import { env, isProduction } from "@/lib/env";
import { audit, AUDIT } from "@/lib/audit";
import { recordLearningEvent } from "@/lib/events";

/**
 * Better Auth instance (plan §0.1-1): all security primitives — password
 * hashing (scrypt), session tokens, cookie flags, CSRF/origin checks, login
 * rate limiting, revocation, account ban, impersonation — come from the
 * framework. Build Bunny's custom layer is identity/provisioning policy only
 * (see modules/auth/server/provisioning.ts).
 *
 * Students sign in with a school-scoped username stored namespaced as
 * `{schoolCode}__{username}` (globally unique column, per-school UX).
 * Public self-signup is disabled — every account is provisioned.
 */
export const auth = betterAuth({
  appName: "Build Bunny",
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,
    minPasswordLength: 6, // young students use generated word-pair passwords
    maxPasswordLength: 128,
  },

  session: {
    // Staff-oriented default; students get a stricter absolute TTL enforced in
    // getSessionContext (shared classroom devices).
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/*": { window: 60 * 15, max: 10 },
      "/change-password": { window: 60 * 15, max: 5 },
    },
  },

  user: {
    additionalFields: {
      schoolId: { type: "string", required: false, input: false },
      displayName: { type: "string", required: false, input: false },
      mustChangePassword: { type: "boolean", required: false, input: false },
      locale: { type: "string", required: false, input: false },
      avatarId: { type: "string", required: false, input: false },
    },
  },

  advanced: {
    useSecureCookies: isProduction,
  },

  databaseHooks: {
    session: {
      create: {
        // Every successful sign-in creates a session — the single reliable
        // place to audit logins and emit the STUDENT_LOGIN learning event.
        after: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { role: true, schoolId: true },
          });
          if (!user) return;
          await audit({
            action: AUDIT.auth.loginSuccess,
            actorUserId: session.userId,
            actorRole: user.role,
            schoolId: user.schoolId,
            ip: session.ipAddress,
          });
          if (user.role === "STUDENT" && user.schoolId) {
            await recordLearningEvent({
              type: "STUDENT_LOGIN",
              schoolId: user.schoolId,
              studentUserId: session.userId,
            });
          }
        },
      },
    },
  },

  trustedOrigins: [env.NEXT_PUBLIC_APP_URL],

  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 64, // namespaced: {schoolCode}__{username}
    }),
    admin({
      // better-auth >=1.6 requires every adminRoles value to exist in `roles`;
      // plugin init throws otherwise. Platform roles get the framework's admin
      // capabilities, everyone else the default user capabilities — real
      // product authorization lives in our own permissions module.
      roles: {
        SUPER_ADMIN: adminAc,
        NITAQ_ADMIN: adminAc,
        SCHOOL_ADMIN: userAc,
        TEACHER: userAc,
        STUDENT: userAc,
      },
      adminRoles: ["SUPER_ADMIN", "NITAQ_ADMIN"],
      defaultRole: "STUDENT",
      defaultBanReason: "Account disabled by your school",
    }),
    // Must be last: applies Set-Cookie correctly inside Next.js server actions.
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
