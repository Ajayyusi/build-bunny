import "server-only";

import { db } from "@/lib/db";
import { audit, AUDIT } from "@/lib/audit";
import type { SessionContext } from "@/modules/auth/server/session";
import { createStudent, type CreatedCredentials } from "@/modules/auth/server/provisioning";

/**
 * The CSV student importer (plan §1.2). Column contract is STRICT and data-
 * minimizing: a file carrying any column outside this set is rejected whole,
 * naming the offending columns — nothing is ever silently dropped.
 */
const REQUIRED_COLUMNS = [
  "student_identifier",
  "first_name",
  "last_initial",
  "grade",
  "class_name",
] as const;
const OPTIONAL_COLUMNS = ["username"] as const;
const KNOWN_COLUMNS: readonly string[] = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

function requireSchool(ctx: SessionContext): string {
  if (!ctx.schoolId) {
    throw new Error("This operation requires a school-scoped session");
  }
  return ctx.schoolId;
}

// ── CSV parsing (RFC 4180 subset: quoted fields, "" escape, \n/\r\n rows) ──

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, ""); // strip BOM from Excel exports

  for (let i = 0; i < src.length; i++) {
    const char = src[i];
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0]?.trim() === ""));
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

// ── Plan building (shared by dry-run and commit — both re-parse the same text) ──

export interface ImportRowResult {
  /** 1-based, header row excluded. */
  row: number;
  studentIdentifier: string;
  firstName: string;
  lastInitial: string;
  grade: number | null;
  className: string;
  classId: string | null;
  username: string | null;
  action: "create" | "update" | "error";
  existingUserId: string | null;
  errors: string[];
}

export interface ImportPlan {
  ok: boolean;
  columnErrors?: { unrecognized: string[]; missing: string[] };
  rows: ImportRowResult[];
  summary: { toCreate: number; toUpdate: number; errors: number };
}

function usernameFromFirstName(firstName: string): string {
  const base = firstName
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip Latin accents (NFKD combining marks)
    .replace(/[^a-z0-9]/g, "");
  return base.length > 0 ? base : "student";
}

async function buildImportPlan(ctx: SessionContext, csvText: string): Promise<ImportPlan> {
  const schoolId = requireSchool(ctx);
  const table = parseCsv(csvText);
  if (table.length === 0) {
    return { ok: false, columnErrors: { unrecognized: [], missing: [...REQUIRED_COLUMNS] }, rows: [], summary: { toCreate: 0, toUpdate: 0, errors: 0 } };
  }

  const rawHeaders = table[0]!.map(normalizeHeader);
  const unrecognized = rawHeaders.filter((h) => h !== "" && !KNOWN_COLUMNS.includes(h));
  const missing = REQUIRED_COLUMNS.filter((c) => !rawHeaders.includes(c));
  if (unrecognized.length > 0 || missing.length > 0) {
    return {
      ok: false,
      columnErrors: { unrecognized, missing },
      rows: [],
      summary: { toCreate: 0, toUpdate: 0, errors: 0 },
    };
  }

  const dataRows = table.slice(1).filter((r) => r.some((cell) => cell.trim() !== ""));
  const colIndex = (name: string) => rawHeaders.indexOf(name);

  // School context loaded once: classes (name → id/grade) and existing
  // identifiers/usernames for dedupe + collision checks.
  const [school, classes, existingStudents] = await Promise.all([
    db.school.findUnique({ where: { id: schoolId }, select: { code: true } }),
    db.class.findMany({
      where: { schoolId },
      select: { id: true, name: true, academicYear: { select: { isActive: true } } },
    }),
    db.studentProfile.findMany({
      where: { schoolId },
      select: { userId: true, studentIdentifier: true, user: { select: { displayUsername: true } } },
    }),
  ]);
  if (!school) throw new Error("School not found");

  const classByName = new Map<string, { id: string; isActive: boolean }[]>();
  for (const c of classes) {
    const key = c.name.trim().toLowerCase();
    const list = classByName.get(key) ?? [];
    list.push({ id: c.id, isActive: c.academicYear.isActive });
    classByName.set(key, list);
  }
  // Prefer the active-academic-year class when the same name recurs across years.
  function resolveClass(name: string): { id: string } | undefined {
    const candidates = classByName.get(name.trim().toLowerCase());
    if (!candidates || candidates.length === 0) return undefined;
    return [...candidates].sort((a, b) => Number(b.isActive) - Number(a.isActive))[0];
  }

  const existingByIdentifier = new Map(existingStudents.map((s) => [s.studentIdentifier, s.userId]));
  const takenUsernames = new Set(
    existingStudents.map((s) => s.user.displayUsername).filter((u): u is string => !!u),
  );
  const seenInFile = new Set<string>();

  const rows: ImportRowResult[] = dataRows.map((cells, i) => {
    const errors: string[] = [];
    const studentIdentifier = (cells[colIndex("student_identifier")] ?? "").trim();
    const firstName = (cells[colIndex("first_name")] ?? "").trim();
    const lastInitial = (cells[colIndex("last_initial")] ?? "").trim();
    const gradeRaw = (cells[colIndex("grade")] ?? "").trim();
    const className = (cells[colIndex("class_name")] ?? "").trim();
    const usernameCol = colIndex("username");
    const usernameRaw = usernameCol >= 0 ? (cells[usernameCol] ?? "").trim().toLowerCase() : "";

    if (!studentIdentifier) errors.push("missing student_identifier");
    if (!firstName) errors.push("missing first_name");
    if (!lastInitial) errors.push("missing last_initial");
    if (!className) errors.push("missing class_name");

    const grade = /^\d+$/.test(gradeRaw) ? Number(gradeRaw) : null;
    if (gradeRaw && grade === null) errors.push(`invalid grade "${gradeRaw}"`);
    if (!gradeRaw) errors.push("missing grade");

    if (studentIdentifier) {
      if (seenInFile.has(studentIdentifier)) {
        errors.push(`duplicate student_identifier "${studentIdentifier}" in file`);
      }
      seenInFile.add(studentIdentifier);
    }

    const matchedClass = className ? resolveClass(className) : undefined;
    if (className && !matchedClass) errors.push(`unknown class_name "${className}"`);

    const existingUserId = studentIdentifier ? (existingByIdentifier.get(studentIdentifier) ?? null) : null;

    let username: string | null = null;
    if (!existingUserId) {
      // Only new accounts need a resolved username — updates keep the login as-is.
      if (usernameRaw) {
        if (takenUsernames.has(usernameRaw)) {
          errors.push(`username "${usernameRaw}" is already taken in this school`);
        }
        username = usernameRaw;
      } else if (firstName) {
        let candidate = usernameFromFirstName(firstName);
        let suffix = 0;
        while (takenUsernames.has(candidate)) {
          suffix += 1;
          candidate = `${usernameFromFirstName(firstName)}${suffix}`;
        }
        username = candidate;
      }
      if (username) takenUsernames.add(username);
    }

    return {
      row: i + 1,
      studentIdentifier,
      firstName,
      lastInitial,
      grade,
      className,
      classId: matchedClass?.id ?? null,
      username,
      action: errors.length > 0 ? "error" : existingUserId ? "update" : "create",
      existingUserId,
      errors,
    };
  });

  const summary = {
    toCreate: rows.filter((r) => r.action === "create").length,
    toUpdate: rows.filter((r) => r.action === "update").length,
    errors: rows.filter((r) => r.action === "error").length,
  };
  return { ok: true, rows, summary };
}

export async function dryRunStudentImport(ctx: SessionContext, csvText: string): Promise<ImportPlan> {
  return buildImportPlan(ctx, csvText);
}

export interface CommitImportResult {
  plan: ImportPlan;
  created: (CreatedCredentials & { displayName: string; studentIdentifier: string })[];
  updatedCount: number;
}

export async function commitStudentImport(
  ctx: SessionContext,
  csvText: string,
): Promise<CommitImportResult> {
  const schoolId = requireSchool(ctx);
  const plan = await buildImportPlan(ctx, csvText);
  if (!plan.ok) return { plan, created: [], updatedCount: 0 };

  const school = await db.school.findUnique({ where: { id: schoolId }, select: { code: true } });
  if (!school) throw new Error("School not found");

  const created: (CreatedCredentials & { displayName: string; studentIdentifier: string })[] = [];
  let updatedCount = 0;

  for (const row of plan.rows) {
    if (row.action === "error") continue;
    const displayName = `${row.firstName} ${row.lastInitial}.`;

    if (row.action === "create") {
      const result = await createStudent(
        { userId: ctx.userId, role: ctx.role },
        {
          schoolId,
          schoolCode: school.code,
          username: row.username ?? row.studentIdentifier,
          displayName,
          studentIdentifier: row.studentIdentifier,
          grade: row.grade ?? 0,
        },
      );
      if (row.classId) {
        await db.classMembership.create({
          data: { schoolId, classId: row.classId, userId: result.userId, role: "STUDENT" },
        });
      }
      created.push({ ...result, displayName, studentIdentifier: row.studentIdentifier });
    } else if (row.action === "update" && row.existingUserId) {
      await db.user.update({ where: { id: row.existingUserId }, data: { displayName } });
      if (row.grade !== null) {
        await db.studentProfile.update({
          where: { userId: row.existingUserId },
          data: { grade: row.grade },
        });
      }
      if (row.classId) {
        await db.classMembership.deleteMany({
          where: { schoolId, userId: row.existingUserId, role: "STUDENT" },
        });
        await db.classMembership.create({
          data: { schoolId, classId: row.classId, userId: row.existingUserId, role: "STUDENT" },
        });
      }
      updatedCount += 1;
    }
  }

  await audit({
    action: AUDIT.students.imported,
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "import",
    meta: {
      created: created.length,
      updated: updatedCount,
      errors: plan.summary.errors,
      rows: plan.rows.length,
    },
  });

  return { plan, created, updatedCount };
}
