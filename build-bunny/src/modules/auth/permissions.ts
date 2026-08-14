import type { Role } from "./roles";

/**
 * Typed resource:action permission catalog (plan §5 D, security doc §1).
 * Scope (own school / own classes / self) is NOT encoded here — it is enforced
 * structurally by the tenant-scoped data layer, which only ever queries within
 * the caller's TenantCtx. Permissions answer "may this role do this at all".
 */
export const PERMISSIONS = [
  // platform administration
  "schools:manage",
  "licences:manage",
  "platform:analytics",
  "platform:settings",
  "impersonation:use",

  // school administration
  "school:profile:write",
  "staff:manage",
  "students:manage",
  "students:write",
  "classes:manage",
  "classes:write",
  "imports:run",

  // credentials / account administration
  "credentials:reset",
  "accounts:disable",

  // curriculum
  "curriculum:author",
  "curriculum:publish",
  "curriculum:read",

  // learning
  "attempts:submit",
  "attempts:read",
  "attempts:feedback",
  "assignments:manage",

  // analytics & reporting
  "analytics:school",
  "analytics:classes",
  "exports:school",

  // recognition
  "certificates:issue",
  "certificates:read",
  // Issuer-side only: a school admin may print and verify their own
  // certificates but may not invalidate one NITAQ issued.
  "certificates:revoke",

  // communication
  "announcements:platform",
  "announcements:school",

  // governance
  "audit:read:platform",
  "audit:read:school",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

/**
 * Role → permission grants. SUPER_ADMIN additionally holds platform:settings
 * exclusively-sensitive operations at the API layer (sudo checks come later).
 */
const GRANTS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: ALL,
  NITAQ_ADMIN: ALL.filter((p) => p !== "platform:settings"),
  SCHOOL_ADMIN: [
    "school:profile:write",
    "staff:manage",
    "students:manage",
    "students:write",
    "classes:manage",
    "classes:write",
    "imports:run",
    "credentials:reset",
    "accounts:disable",
    "curriculum:read",
    "attempts:read",
    "analytics:school",
    "exports:school",
    "certificates:read",
    "announcements:school",
    "audit:read:school",
  ],
  TEACHER: [
    "students:write",
    "classes:write",
    "credentials:reset",
    "curriculum:read",
    "attempts:read",
    "attempts:feedback",
    "assignments:manage",
    "analytics:classes",
    "certificates:read",
  ],
  STUDENT: ["curriculum:read", "attempts:submit"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return GRANTS[role].includes(permission);
}

export function permissionsForRole(role: Role): readonly Permission[] {
  return GRANTS[role];
}
