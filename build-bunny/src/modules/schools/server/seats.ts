import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Licence seat enforcement.
 *
 * Seats were sold, displayed in analytics, and never checked: no
 * provisioning path compared the roster against the limit, so a school could
 * be filled past what it paid for — by hand, by CSV, or by two concurrent
 * requests each seeing room for one more.
 *
 * WHAT CONSUMES A SEAT: an active student account. A disabled student does
 * not, because a disabled account cannot sign in or learn — billing a school
 * for a child who left is not defensible. Deleting is not required to free a
 * seat; disabling is enough, which also keeps their history intact.
 */

export class SeatLimitError extends Error {
  readonly code = "SEAT_LIMIT_REACHED";
  constructor(
    readonly used: number,
    readonly limit: number,
  ) {
    super(`Seat limit reached (${used}/${limit})`);
    this.name = "SeatLimitError";
  }
}

/** A licence that entitles the school to seats right now. */
function activeLicenceWhere(schoolId: string, now: Date): Prisma.LicenceWhereInput {
  return {
    schoolId,
    status: { in: ["ACTIVE", "GRACE"] },
    startsAt: { lte: now },
    expiresAt: { gte: now },
  };
}

/**
 * Seats available to this school, or null when it holds no active licence.
 *
 * Several overlapping licences add up rather than the largest winning — a
 * school that buys a 50-seat top-up alongside its 200 should get 250.
 */
export async function effectiveSeatLimit(
  client: Prisma.TransactionClient | typeof db,
  schoolId: string,
  now: Date = new Date(),
): Promise<number | null> {
  const licences = await client.licence.findMany({
    where: activeLicenceWhere(schoolId, now),
    select: { seats: true },
  });
  if (licences.length === 0) return null;
  return licences.reduce((total, licence) => total + licence.seats, 0);
}

/** Students currently occupying a seat. */
export async function usedSeats(
  client: Prisma.TransactionClient | typeof db,
  schoolId: string,
): Promise<number> {
  return client.user.count({
    where: { schoolId, role: "STUDENT", banned: { not: true } },
  });
}

/**
 * Throws unless `adding` more students fit. MUST be called inside a
 * transaction that also performs the insert.
 *
 * Takes a row lock on the school's licences first. Without it, two requests
 * arriving together both read "49 of 50 used" and both insert, putting the
 * school at 51 — the exact case the ticket calls out. The lock makes
 * concurrent provisioning for one school serialize; different schools are
 * unaffected because they lock different rows.
 */
export async function assertSeatAvailable(
  tx: Prisma.TransactionClient,
  schoolId: string,
  adding = 1,
  now: Date = new Date(),
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Licence" WHERE "schoolId" = ${schoolId} FOR UPDATE`;

  const limit = await effectiveSeatLimit(tx, schoolId, now);
  // No active licence is a licensing failure, not a free-for-all: a school
  // whose licence lapsed must not be able to keep enrolling.
  if (limit === null) throw new SeatLimitError(await usedSeats(tx, schoolId), 0);

  const used = await usedSeats(tx, schoolId);
  if (used + adding > limit) throw new SeatLimitError(used, limit);
}
