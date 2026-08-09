import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { ClassMatrix, ProgressState } from "@/modules/analytics/server/teacher";
import { resolveText } from "@/modules/curriculum/schemas";
import { Avatar, EmptyState, cn } from "@/ui";

import { FlagList } from "../../../_components/FlagBadges";

/**
 * Students × levels progress matrix (m4 deliverable 3): sticky first column
 * (student) and sticky header (level, grouped by world), state + stars on
 * every cell via colour AND glyph — never colour alone. The student column
 * is the click target into student detail (row click, m4 deliverable 3).
 */

const STATUS_STYLE: Record<ProgressState, { glyph: string; className: string }> = {
  LOCKED: { glyph: "🔒", className: "bg-ink/5 text-ink-faint" },
  UNLOCKED: { glyph: "○", className: "bg-brand/8 text-brand" },
  IN_PROGRESS: { glyph: "◐", className: "bg-warning/12 text-warning" },
  COMPLETED: { glyph: "✓", className: "bg-positive/14 text-positive" },
};

interface WorldGroup {
  worldSlug: string;
  worldName: string;
  levels: ClassMatrix["levels"];
}

function groupByWorld(levels: ClassMatrix["levels"], locale: string): WorldGroup[] {
  const groups: WorldGroup[] = [];
  for (const level of levels) {
    const last = groups[groups.length - 1];
    if (last && last.worldSlug === level.worldSlug) {
      last.levels.push(level);
    } else {
      groups.push({
        worldSlug: level.worldSlug,
        worldName: resolveText(level.worldName, locale),
        levels: [level],
      });
    }
  }
  return groups;
}

export async function ProgressMatrix({
  matrix,
  classId,
  locale,
}: {
  matrix: ClassMatrix;
  classId: string;
  locale: string;
}) {
  const t = await getTranslations("staff.teach.matrix");

  if (matrix.students.length === 0) {
    return (
      <EmptyState
        icon={<span className="text-2xl">🧑‍🎓</span>}
        title={t("table.emptyTitle")}
        description={t("table.emptyBody")}
      />
    );
  }
  if (matrix.levels.length === 0) {
    return (
      <EmptyState
        icon={<span className="text-2xl">🗺️</span>}
        title={t("table.noLevelsTitle")}
        description={t("table.noLevelsBody")}
      />
    );
  }

  const worldGroups = groupByWorld(matrix.levels, locale);

  return (
    <div className="overflow-auto rounded-lg border border-border-token" style={{ maxHeight: "70vh" }}>
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th
              rowSpan={2}
              scope="col"
              className="sticky start-0 top-0 z-30 h-[4.5rem] w-44 border-b border-e border-border-token bg-surface-sunken px-3 text-start align-bottom text-xs font-semibold text-ink-muted"
            >
              {t("table.studentColumn")}
            </th>
            {worldGroups.map((group) => (
              <th
                key={group.worldSlug}
                colSpan={group.levels.length}
                scope="colgroup"
                className="sticky top-0 z-20 h-9 border-b border-e border-border-token bg-surface-sunken px-2 text-center text-xs font-semibold text-ink-muted"
              >
                <span className="block truncate">{group.worldName}</span>
              </th>
            ))}
          </tr>
          <tr>
            {matrix.levels.map((level) => (
              <th
                key={level.id}
                scope="col"
                title={resolveText(level.title, locale)}
                className="sticky top-9 z-20 h-9 w-12 border-b border-e border-border-token bg-surface-sunken px-1 text-center text-xs font-semibold tabular-nums text-ink-muted"
              >
                {level.order}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.students.map((student) => (
            <tr key={student.userId} className="border-b border-border-token last:border-b-0">
              <th
                scope="row"
                className="sticky start-0 z-10 w-44 border-e border-border-token bg-surface-raised p-0 text-start font-normal"
              >
                <Link
                  href={`/teach/classes/${classId}/students/${student.userId}`}
                  className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-surface-sunken"
                >
                  <Avatar displayName={student.displayName} size="sm" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold text-ink">{student.displayName}</span>
                    <FlagList flags={student.flags} />
                  </span>
                </Link>
              </th>
              {matrix.levels.map((level) => {
                const cell = student.cells[level.id];
                const status = cell?.status ?? "LOCKED";
                const style = STATUS_STYLE[status];
                return (
                  <td
                    key={level.id}
                    className={cn("border-e border-border-token p-0 text-center", style.className)}
                  >
                    <span
                      role="img"
                      aria-label={t("cell.label", {
                        student: student.displayName,
                        level: resolveText(level.title, locale),
                        state: status,
                        stars: cell?.stars ?? 0,
                        attempts: cell?.attempts ?? 0,
                      })}
                      className="flex h-11 w-12 flex-col items-center justify-center gap-0.5"
                    >
                      <span aria-hidden="true" className="text-sm leading-none">
                        {style.glyph}
                      </span>
                      {(cell?.stars ?? 0) > 0 ? (
                        <span aria-hidden="true" className="text-[10px] font-bold leading-none tabular-nums">
                          ★{cell?.stars}
                        </span>
                      ) : null}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function MatrixLegend() {
  const t = await getTranslations("staff.teach.matrix.legend");
  const entries: ProgressState[] = ["LOCKED", "UNLOCKED", "IN_PROGRESS", "COMPLETED"];
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border-token bg-surface-raised px-4 py-3 text-sm">
      <span className="font-semibold text-ink">{t("heading")}</span>
      {entries.map((state) => (
        <span key={state} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-6 items-center justify-center rounded text-xs",
              STATUS_STYLE[state].className,
            )}
          >
            {STATUS_STYLE[state].glyph}
          </span>
          <span className="text-ink-muted">{t(state)}</span>
        </span>
      ))}
      <span className="text-ink-muted">{t("starsHint")}</span>
    </div>
  );
}
