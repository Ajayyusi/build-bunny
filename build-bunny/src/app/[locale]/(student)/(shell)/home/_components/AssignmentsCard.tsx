import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { MyAssignment } from "@/modules/assignments/server/queries";
import { resolveText } from "@/modules/curriculum/schemas";
import { BunnyMascot, cn, createDateFormat } from "@/ui";

interface Props {
  assignments: MyAssignment[];
  locale: string;
}

/**
 * What the teacher has actually asked this student to do.
 *
 * Teachers could already set assignments — creating one even force-unlocks
 * its levels — but nothing ever told the child, so the work arrived as
 * levels that silently became playable. This is the missing half.
 *
 * Deliberately not a nag: finished assignments show as done and stay
 * visible (finishing something should be worth seeing), overdue work is
 * marked plainly rather than in alarm red, and there is no countdown or
 * streak pressure attached to it.
 */
export async function AssignmentsCard({ assignments, locale }: Props) {
  const t = await getTranslations("student.home.assignments");
  if (assignments.length === 0) return null;

  const dateFormat = createDateFormat(locale, { dateStyle: "medium" });
  const now = Date.now();

  return (
    <section className="bb-cascade flex flex-col gap-3" style={{ "--i": 2 } as React.CSSProperties}>
      <div className="flex items-center gap-2">
        <BunnyMascot state="pointing" size="xs" />
        <h2 className="font-display text-lg font-bold text-ink">{t("heading")}</h2>
      </div>

      <ul className="flex flex-col gap-3">
        {assignments.map((assignment) => {
          const pct =
            assignment.totalLevels === 0
              ? 0
              : Math.round((assignment.completedLevels / assignment.totalLevels) * 100);
          const overdue =
            !assignment.done && assignment.dueAt !== null && assignment.dueAt.getTime() < now;

          return (
            <li
              key={assignment.id}
              className={cn(
                "rounded-2xl border p-4",
                assignment.done
                  ? "border-positive/40 bg-positive/5"
                  : "border-border-token bg-surface-raised",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-bold text-ink">
                      {assignment.title}
                    </span>
                    {assignment.done ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-positive/15 px-2 py-0.5 text-xs font-bold text-positive">
                        <span aria-hidden="true">✓</span>
                        {t("done")}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {t("from", { teacher: assignment.teacherName })} ·{" "}
                    {resolveText(assignment.targetLabel, locale)}
                  </span>
                  {assignment.note ? (
                    <span className="text-sm text-ink">{assignment.note}</span>
                  ) : null}
                  {assignment.dueAt !== null ? (
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        overdue ? "text-warning" : "text-ink-muted",
                      )}
                    >
                      {overdue ? t("wasDue") : t("due")}{" "}
                      <span dir="ltr">{dateFormat.format(assignment.dueAt)}</span>
                    </span>
                  ) : null}
                </div>

                {assignment.done || assignment.nextLevelId === null ? null : (
                  <Link
                    href={`/play/${assignment.nextLevelId}`}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong"
                  >
                    <span aria-hidden="true">▶</span>
                    {assignment.completedLevels === 0 ? t("start") : t("continue")}
                  </Link>
                )}
              </div>

              {assignment.totalLevels > 1 ? (
                <div className="mt-3 flex items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                    <span
                      aria-hidden="true"
                      className="block h-full rounded-full bg-brand transition-[width] duration-700 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="text-xs font-bold tabular-nums text-ink-muted">
                    {t("progress", {
                      done: assignment.completedLevels,
                      total: assignment.totalLevels,
                    })}
                  </span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
