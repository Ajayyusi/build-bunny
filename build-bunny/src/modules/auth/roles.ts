import { z } from "zod";

/**
 * Role model (plan §5 D). The User.role column is a string for Better Auth
 * admin-plugin compatibility; this module is the single source of truth for
 * valid values. PARENT is reserved for a future phase.
 */
export const ROLES = [
  "SUPER_ADMIN",
  "NITAQ_ADMIN",
  "SCHOOL_ADMIN",
  "TEACHER",
  "STUDENT",
] as const;

export type Role = (typeof ROLES)[number];

export const roleSchema = z.enum(ROLES);

export const PLATFORM_ROLES: readonly Role[] = ["SUPER_ADMIN", "NITAQ_ADMIN"];
export const SCHOOL_STAFF_ROLES: readonly Role[] = ["SCHOOL_ADMIN", "TEACHER"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isPlatformRole(role: Role): boolean {
  return PLATFORM_ROLES.includes(role);
}

/** Where each role lands after login. */
export function homePathForRole(role: Role): string {
  switch (role) {
    case "SUPER_ADMIN":
    case "NITAQ_ADMIN":
      return "/nitaq";
    case "SCHOOL_ADMIN":
      return "/school";
    case "TEACHER":
      return "/teach";
    case "STUDENT":
      return "/home";
  }
}
