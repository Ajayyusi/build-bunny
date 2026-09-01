import { z } from "zod";

/**
 * The rules for a student's own fields, in one place.
 *
 * There are two ways a student row gets created — the add-student form and
 * the CSV importer — and they enforced different rules. The form required a
 * grade of 1-12 and a username matching a charset; the importer accepted any
 * non-negative integer with no upper bound, and took usernames with no
 * charset or length check at all. StudentProfile.grade is a bare Int with no
 * CHECK constraint, so the database was not a backstop either.
 *
 * That meant a CSV could create children in grade 0, 99 or 2024, which then
 * flowed into every grade-keyed rollup in teacher and school analytics. The
 * bulk path is the one schools actually use for onboarding, so the weaker
 * rules were the ones doing most of the work.
 *
 * Deliberately NOT server-only: the import wizard is a client component and
 * should be able to show the same rules before a file is ever uploaded.
 */

/** Grades this product is built for — the brief's Grades 3-7, with room either side. */
export const GRADE_MIN = 1;
export const GRADE_MAX = 12;

export const studentGrade = z.coerce
  .number()
  .int()
  .min(GRADE_MIN, `Grade must be between ${GRADE_MIN} and ${GRADE_MAX}`)
  .max(GRADE_MAX, `Grade must be between ${GRADE_MIN} and ${GRADE_MAX}`);

/**
 * Usernames are typed by young children on shared tablets, so the charset is
 * deliberately narrow: lowercase, digits, and three separators. Uniqueness is
 * per-school and enforced separately (composeStudentUsername namespaces it).
 */
export const USERNAME_MIN = 2;
export const USERNAME_MAX = 40;

export const studentUsername = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN, `Username must be at least ${USERNAME_MIN} characters`)
  .max(USERNAME_MAX, `Username must be at most ${USERNAME_MAX} characters`)
  .regex(
    /^[a-z0-9._-]+$/,
    "Username may use lowercase letters, numbers, dots, hyphens and underscores only",
  );

export const studentDisplayName = z.string().trim().min(1).max(120);
export const studentIdentifier = z.string().trim().min(1).max(60);

/** Everything the add-student form collects about the student themselves. */
export const studentFields = z.object({
  username: studentUsername,
  displayName: studentDisplayName,
  studentIdentifier,
  grade: studentGrade,
});

/**
 * The first Zod message for a value, or null when it is valid.
 *
 * The importer reports problems per ROW rather than throwing, so the wizard
 * can show a child-by-child list of what to fix. This keeps that behaviour
 * while making the rules the same ones the form applies.
 */
export function fieldError(schema: z.ZodTypeAny, value: unknown): string | null {
  const parsed = schema.safeParse(value);
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? "invalid value");
}
