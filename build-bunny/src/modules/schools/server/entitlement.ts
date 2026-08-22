import "server-only";

import { db } from "@/lib/db";

/**
 * Whether a school may use the product right now, and how much.
 *
 * School status and licence rows existed but decided nothing: they were read
 * by analytics and a badge in the console, while getSessionContext checked
 * only role, ban state and student session age. An inactive school, an
 * expired licence, or a SUSPENDED one carried on signing in and submitting
 * work exactly like a paying customer, so the product could not enforce the
 * contract it is sold under.
 *
 * POLICY (from the audit's proposal — the states are deliberately explicit
 * so that "what does a school get when they stop paying" is answered in one
 * readable place rather than implied across call sites):
 *
 *   ACTIVE     full use
 *   GRACE      full use — the grace window exists to keep CHILDREN learning
 *              while adults sort out a renewal; punishing pupils for an
 *              unpaid invoice is the wrong lever
 *   READ_ONLY  may sign in and read their work; may not submit, earn XP, or
 *              be provisioned. Nothing already earned disappears
 *   SUSPENDED  no access to protected product routes
 *   EXPIRED    no access to protected product routes
 *   NO_LICENCE no access — a school with no licence row was never sold one
 *
 * Platform staff (no schoolId) are never gated: they must be able to reach a
 * suspended school in order to un-suspend it.
 */

export type EntitlementState =
  | "ACTIVE"
  | "GRACE"
  | "READ_ONLY"
  | "SUSPENDED"
  | "EXPIRED"
  | "NO_LICENCE"
  | "SCHOOL_INACTIVE";

export interface Entitlement {
  state: EntitlementState;
  /** May reach protected product routes at all. */
  canAccess: boolean;
  /** May submit attempts, earn XP, and be provisioned. */
  canWrite: boolean;
}

const ENTITLEMENTS: Record<EntitlementState, Omit<Entitlement, "state">> = {
  ACTIVE: { canAccess: true, canWrite: true },
  GRACE: { canAccess: true, canWrite: true },
  READ_ONLY: { canAccess: true, canWrite: false },
  SUSPENDED: { canAccess: false, canWrite: false },
  EXPIRED: { canAccess: false, canWrite: false },
  NO_LICENCE: { canAccess: false, canWrite: false },
  SCHOOL_INACTIVE: { canAccess: false, canWrite: false },
};

function build(state: EntitlementState): Entitlement {
  return { state, ...ENTITLEMENTS[state] };
}

/** Platform staff and any other unscoped session: never gated. */
export const UNRESTRICTED: Entitlement = build("ACTIVE");

/**
 * The school's best current entitlement.
 *
 * "Best" because a school may hold several licences (a renewal alongside the
 * old term, or a seat top-up); one expired row must not blackout a school
 * whose current licence is fine.
 */
export async function resolveEntitlement(
  schoolId: string,
  now: Date = new Date(),
): Promise<Entitlement> {
  const school = await db.school.findUnique({
    where: { id: schoolId },
    select: {
      status: true,
      licences: {
        select: { status: true, startsAt: true, expiresAt: true, graceDays: true },
      },
    },
  });
  if (!school) return build("NO_LICENCE");
  if (school.status === "INACTIVE") return build("SCHOOL_INACTIVE");
  if (school.licences.length === 0) return build("NO_LICENCE");

  const states = school.licences.map((licence) => {
    if (licence.status === "SUSPENDED") return "SUSPENDED" as const;
    if (now < licence.startsAt) return "EXPIRED" as const; // not started yet
    if (now <= licence.expiresAt) {
      return licence.status === "READ_ONLY"
        ? ("READ_ONLY" as const)
        : licence.status === "GRACE"
          ? ("GRACE" as const)
          : ("ACTIVE" as const);
    }
    // Past the end date: the grace window keeps children learning while a
    // renewal is processed, and only then does it become EXPIRED.
    const graceEnds = new Date(licence.expiresAt);
    graceEnds.setDate(graceEnds.getDate() + licence.graceDays);
    return now <= graceEnds ? ("GRACE" as const) : ("EXPIRED" as const);
  });

  const RANK: EntitlementState[] = ["ACTIVE", "GRACE", "READ_ONLY", "SUSPENDED", "EXPIRED"];
  for (const candidate of RANK) {
    if (states.includes(candidate as never)) return build(candidate);
  }
  return build("EXPIRED");
}
