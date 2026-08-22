import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { isRole } from "@/modules/auth/roles";
import { listSchoolAuditLogs } from "@/modules/schools/server/queries";
import {
  Badge,
  createDateFormat,
  DataTable,
  EmptyState,
  PageHeader,
  type BadgeVariant,
  type DataTableColumn,
} from "@/ui";

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Who did what in this school.
 *
 * `listSchoolAuditLogs` has existed, been registered in tenantScopedQueries
 * and been isolation-tested since m4 — with no route rendering it. A tested
 * query nobody can reach is the same failure as an untested one from the
 * school's point of view: the accountability record was being written and
 * shown to nobody.
 *
 * It matters most for the actions a school admin cannot otherwise see: who
 * reset a child's password, who disabled an account, who erased a student.
 * The NITAQ console has had this view all along; the schools whose data it
 * describes did not.
 *
 * Read-only by design, and scoped to this school by the query itself — a
 * school admin sees their own school's trail and no one else's.
 */

// Keys are the AuditOutcome enum exactly: SUCCESS | DENIED | ERROR. It had
// a "FAILURE" that the enum has never contained, and omitted the ERROR that
// it does — so a failed action rendered with the neutral fallback.
const OUTCOME_BADGES: Record<string, BadgeVariant> = {
  SUCCESS: "positive",
  DENIED: "warning",
  ERROR: "danger",
};

export default async function SchoolActivityPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SCHOOL_ADMIN");

  const [logs, t, tAudit, tCommon] = await Promise.all([
    listSchoolAuditLogs(ctx, 100),
    getTranslations("staff.school.activityPage"),
    // platform.audit holds the column headers and outcome words; the
    // sibling platform.auditLog holds only that page's title and filters.
    getTranslations("platform.audit"),
    getTranslations("common"),
  ]);

  const dateTimeFormat = createDateFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  type Row = (typeof logs)[number];
  const columns: DataTableColumn<Row>[] = [
    {
      key: "time",
      header: tAudit("time"),
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums">
          {dateTimeFormat.format(row.createdAt)}
        </span>
      ),
    },
    {
      key: "action",
      // The raw action key is deliberately shown as code rather than
      // prettified: these are stable identifiers a support conversation can
      // quote exactly, and inventing friendly names for 40+ of them would
      // create a second vocabulary that drifts from the one in the logs.
      header: tAudit("action"),
      cell: (row) => <code className="font-mono text-xs">{row.action}</code>,
    },
    {
      key: "actorRole",
      header: tAudit("actorRole"),
      cell: (row) =>
        row.actorRole && isRole(row.actorRole)
          ? tCommon(`roles.${row.actorRole}`)
          : (row.actorRole ?? "—"),
    },
    {
      key: "outcome",
      header: tAudit("outcome"),
      cell: (row) => (
        <Badge variant={OUTCOME_BADGES[row.outcome] ?? "neutral"}>
          {tAudit(row.outcome)}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {logs.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <DataTable
          columns={columns}
          rows={logs}
          rowKey={(row) => row.id}
          emptyMessage={t("emptyBody")}
        />
      )}
    </div>
  );
}
