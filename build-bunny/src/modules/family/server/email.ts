import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isMailConfigured, sendMail } from "@/lib/mail";
import { ConflictError } from "@/modules/auth/server/guard";
import type { SessionContext } from "@/modules/auth/server/session";
import { AuthError } from "@/modules/auth/server/session";

import { renderInviteEmail, renderWeeklyEmail, type FamilyEmailLocale } from "./email-render";
import { assertStudentAccess } from "./links";
import { summarizeChildWeek } from "./summary";

/**
 * The weekly family email (brief §6), sent through Resend.
 *
 * Privacy rules, all enforced here:
 *  - A teacher adds ONE address per child. Nothing about the child is sent
 *    to it until the family confirms from that inbox: the invitation names
 *    the school, never the child, so a mistyped address learns nothing.
 *  - An invitation can be confirmed for 14 days, then it lapses.
 *  - Every weekly email carries a one-click stop (List-Unsubscribe) and a
 *    visible stop link. Stopping is immediate.
 *  - Removing the address, disabling the child, or erasing the child
 *    deletes the row. The address is never written to the audit log.
 *
 * Links in the emails carry `{id}.{hmac}` rather than a stored token, so
 * every weekly email can include the stop link without keeping a secret in
 * the database. Replacing the address creates a new row (a new id), which
 * retires every link sent to the old one.
 */

export const INVITE_DAYS = 14;
/**
 * The cron runs on Thursday and again on Friday (vercel.json): Friday
 * catches whatever Thursday could not send. An address that got a summary
 * in the last 3 days is skipped, so Friday never repeats Thursday, and a
 * family first sent on a Friday is back on Thursdays the next week.
 */
const RESEND_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
/** A repeat invite to the same address inside this window sends nothing new. */
const REINVITE_MS = 10 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Links ──────────────────────────────────────────────────────────────

function signature(id: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`family-email:v1:${id}`)
    .digest("base64url")
    .slice(0, 32);
}

export function familyEmailToken(id: string): string {
  return `${id}.${signature(id)}`;
}

/** The row id a token names, or null when it is malformed or forged. */
export function readFamilyEmailToken(token: string): string | null {
  const match = /^([a-z0-9]{10,40})\.([A-Za-z0-9_-]{32})$/.exec(token);
  if (!match) return null;
  const [, id, given] = match as unknown as [string, string, string];
  const expected = Buffer.from(signature(id));
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? id : null;
}

function appUrl(path: string): string {
  return new URL(path, env.NEXT_PUBLIC_APP_URL).toString();
}

export function familyEmailPageUrl(locale: string, id: string): string {
  return appUrl(`/${locale}/family/email/${familyEmailToken(id)}`);
}

export function familyEmailStopUrl(id: string): string {
  return appUrl(`/api/family/email?intent=stop&token=${familyEmailToken(id)}`);
}

// ─── Teacher side ───────────────────────────────────────────────────────

export type FamilyEmailState = "none" | "pending" | "active" | "stopped";

export interface FamilyEmailStatus {
  configured: boolean;
  state: FamilyEmailState;
  email: string | null;
  locale: FamilyEmailLocale;
  inviteSentAt: Date | null;
  lastSentAt: Date | null;
  stoppedAt: Date | null;
}

function stateOf(row: { confirmedAt: Date | null; stoppedAt: Date | null; inviteSentAt: Date }, now: Date): FamilyEmailState {
  if (row.stoppedAt) return "stopped";
  if (row.confirmedAt) return "active";
  // A lapsed invitation reads as off: the teacher sends a new one.
  return now.getTime() - row.inviteSentAt.getTime() > INVITE_DAYS * DAY_MS ? "none" : "pending";
}

const asLocale = (value: string): FamilyEmailLocale => (value === "ar" ? "ar" : "en");

export async function getFamilyEmailStatus(
  ctx: SessionContext,
  studentUserId: string,
  now = new Date(),
): Promise<FamilyEmailStatus | null> {
  let schoolId: string;
  try {
    schoolId = await assertStudentAccess(ctx, studentUserId);
  } catch {
    return null;
  }
  const row = await db.familyEmail.findFirst({
    where: { schoolId, studentUserId },
    select: { email: true, locale: true, inviteSentAt: true, confirmedAt: true, stoppedAt: true, lastSentAt: true },
  });
  const configured = isMailConfigured();
  if (!row) {
    return { configured, state: "none", email: null, locale: "en", inviteSentAt: null, lastSentAt: null, stoppedAt: null };
  }
  const state = stateOf(row, now);
  return {
    configured,
    state,
    email: state === "none" ? null : row.email,
    locale: asLocale(row.locale),
    inviteSentAt: row.inviteSentAt,
    lastSentAt: row.lastSentAt,
    stoppedAt: row.stoppedAt,
  };
}

export async function inviteFamilyEmailCore(
  ctx: SessionContext,
  input: { studentUserId: string; email: string; locale: FamilyEmailLocale },
  now = new Date(),
): Promise<{ state: FamilyEmailState }> {
  // The address outlives the session; one added while a platform admin is
  // viewing as a teacher would be attributed to the teacher.
  if (ctx.impersonatedBy) throw new AuthError("FORBIDDEN");
  const schoolId = await assertStudentAccess(ctx, input.studentUserId);
  if (!isMailConfigured()) throw new ConflictError("EMAIL_NOT_CONFIGURED");
  const email = input.email.trim().toLowerCase();

  const existing = await db.familyEmail.findFirst({
    where: { schoolId, studentUserId: input.studentUserId },
    select: { id: true, email: true, inviteSentAt: true, confirmedAt: true, stoppedAt: true },
  });
  if (existing && existing.email === email) {
    const state = stateOf(existing, now);
    if (state === "active") {
      // Already confirmed: only the language can change, no new invitation.
      await db.familyEmail.update({ where: { id: existing.id }, data: { locale: input.locale } });
      return { state };
    }
    if (state === "pending" && now.getTime() - existing.inviteSentAt.getTime() < REINVITE_MS) {
      return { state };
    }
  }

  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true } });
  // A new id every time retires every link sent before. The invitation goes
  // out first, so a failed send leaves the old address exactly as it was.
  const id = randomBytes(12).toString("hex");
  const message = renderInviteEmail({
    locale: input.locale,
    schoolName: school.name,
    confirmUrl: familyEmailPageUrl(input.locale, id),
  });
  const sent = await sendMail({ to: email, ...message, idempotencyKey: `family-invite:${id}` });
  if (!sent.ok) throw new ConflictError("EMAIL_SEND_FAILED");

  await db.$transaction([
    db.familyEmail.deleteMany({ where: { studentUserId: input.studentUserId } }),
    db.familyEmail.create({
      data: {
        id,
        schoolId,
        studentUserId: input.studentUserId,
        createdById: ctx.userId,
        email,
        locale: input.locale,
        inviteSentAt: now,
      },
    }),
  ]);

  await audit({
    action: "family_email.invite",
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "User",
    targetId: input.studentUserId,
    meta: { locale: input.locale },
  });
  return { state: "pending" };
}

export async function removeFamilyEmailCore(
  ctx: SessionContext,
  input: { studentUserId: string },
): Promise<{ removed: number }> {
  const schoolId = await assertStudentAccess(ctx, input.studentUserId);
  const result = await db.familyEmail.deleteMany({ where: { schoolId, studentUserId: input.studentUserId } });
  await audit({
    action: "family_email.remove",
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "User",
    targetId: input.studentUserId,
    meta: { removed: result.count },
  });
  return { removed: result.count };
}

// ─── Family side (the token is the credential) ──────────────────────────

export interface FamilyEmailPage {
  state: "pending" | "active" | "stopped";
  schoolName: string;
  /** Only once the family has confirmed: before that the child stays unnamed. */
  displayName: string | null;
}

async function loadByToken(token: string) {
  const id = readFamilyEmailToken(token);
  if (!id) return null;
  return db.familyEmail.findUnique({
    where: { id },
    select: {
      id: true,
      schoolId: true,
      studentUserId: true,
      inviteSentAt: true,
      confirmedAt: true,
      stoppedAt: true,
      school: { select: { name: true } },
      student: { select: { displayName: true } },
    },
  });
}

export async function getFamilyEmailPage(token: string, now = new Date()): Promise<FamilyEmailPage | null> {
  const row = await loadByToken(token);
  if (!row) return null;
  const state = stateOf(row, now);
  if (state === "none") return null;
  return {
    state,
    schoolName: row.school.name,
    displayName: state === "active" ? row.student.displayName : null,
  };
}

export async function confirmFamilyEmail(token: string, now = new Date()): Promise<boolean> {
  const row = await loadByToken(token);
  if (!row) return false;
  // Stopped stays stopped (starting again is a new invitation from the
  // teacher), and a lapsed invitation can't be revived from the old email.
  const state = stateOf(row, now);
  if (state === "stopped" || state === "none") return false;
  if (state === "active") return true;
  await db.familyEmail.update({ where: { id: row.id }, data: { confirmedAt: now } });
  await audit({
    action: "family_email.confirm",
    schoolId: row.schoolId,
    targetType: "User",
    targetId: row.studentUserId,
  });
  return true;
}

export async function stopFamilyEmail(token: string, now = new Date()): Promise<boolean> {
  const row = await loadByToken(token);
  if (!row) return false;
  if (!row.stoppedAt) {
    await db.familyEmail.update({ where: { id: row.id }, data: { stoppedAt: now } });
    await audit({
      action: "family_email.stop",
      schoolId: row.schoolId,
      targetType: "User",
      targetId: row.studentUserId,
    });
  }
  return true;
}

// ─── The weekly run ─────────────────────────────────────────────────────

export interface WeeklyRunResult {
  configured: boolean;
  due: number;
  sent: number;
  quiet: number;
  closed: number;
  failed: number;
}

/**
 * Sends this week's summaries. Safe to run more than once: an address that
 * got one in the last 3 days is skipped, and each send carries an
 * idempotency key for the week, so a retried run never double-sends.
 * A week with nothing played sends nothing ("quiet"), and a school that is
 * closed, out of licence, or a disabled child sends nothing ("closed").
 */
export async function sendWeeklyFamilyEmails(
  now = new Date(),
  options: { limit?: number; pauseMs?: number } = {},
): Promise<WeeklyRunResult> {
  const result: WeeklyRunResult = { configured: isMailConfigured(), due: 0, sent: 0, quiet: 0, closed: 0, failed: 0 };
  if (!result.configured) return result;
  const limit = options.limit ?? 400;
  // Resend's default limit is 2 requests a second.
  const pauseMs = options.pauseMs ?? 550;

  const rows = await db.familyEmail.findMany({
    where: {
      confirmedAt: { not: null },
      stoppedAt: null,
      OR: [{ lastSentAt: null }, { lastSentAt: { lt: new Date(now.getTime() - RESEND_AFTER_MS) } }],
    },
    orderBy: { confirmedAt: "asc" },
    take: limit,
    select: { id: true, schoolId: true, studentUserId: true, email: true, locale: true },
  });
  result.due = rows.length;
  const weekKey = isoWeek(now);

  for (const [index, row] of rows.entries()) {
    const week = await summarizeChildWeek(row.schoolId, row.studentUserId, now);
    if (!week) {
      result.closed += 1;
      continue;
    }
    if (week.thisWeek.activeDays === 0 && week.thisWeek.levelsCompleted === 0) {
      result.quiet += 1;
      continue;
    }
    const locale = asLocale(row.locale);
    const message = renderWeeklyEmail({ locale, week, now, manageUrl: familyEmailPageUrl(locale, row.id) });
    if (index > 0 && pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs));
    const sent = await sendMail({
      to: row.email,
      ...message,
      headers: {
        "List-Unsubscribe": `<${familyEmailStopUrl(row.id)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      idempotencyKey: `family-weekly:${row.id}:${weekKey}`,
    });
    if (sent.ok) {
      await db.familyEmail.update({ where: { id: row.id }, data: { lastSentAt: now } });
      result.sent += 1;
    } else {
      result.failed += 1;
    }
  }
  return result;
}

/** "2026-W39": the idempotency key's week. */
export function isoWeek(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
