import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { listSchools, searchPlatformAuditLogs } from "@/modules/schools/server/platform-queries";
import { Badge, Button, DataTable, Field, Input, PageHeader, Select, type BadgeVariant, type DataTableColumn } from "@/ui";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const OUTCOME_BADGES: Record<string, BadgeVariant> = {
  SUCCESS: "positive",
  DENIED: "warning",
  ERROR: "danger",
};

const ROLE_KEYS = ["SUPER_ADMIN", "NITAQ_ADMIN", "SCHOOL_ADMIN", "TEACHER", "STUDENT", "SYSTEM"] as const;
function isRoleKey(value: string): value is (typeof ROLE_KEYS)[number] {
  return (ROLE_KEYS as readonly string[]).includes(value);
}

function asString(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function AuditLogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SUPER_ADMIN", "NITAQ_ADMIN");
  const sp = await searchParams;

  const action = asString(sp.action);
  const actorUserId = asString(sp.actorUserId);
  const schoolId = asString(sp.schoolId);
  const from = asString(sp.from);
  const to = asString(sp.to);

  const [logs, schools, t, tAudit, tCommon] = await Promise.all([
    searchPlatformAuditLogs(ctx, {
      action: action || undefined,
      actorUserId: actorUserId || undefined,
      schoolId: schoolId || undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
    }),
    listSchools(ctx),
    getTranslations("platform.auditLog"),
    getTranslations("platform.audit"),
    getTranslations("common"),
  ]);

  const dateTimeFormat = new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  type Row = (typeof logs)[number];
  const columns: DataTableColumn<Row>[] = [
    {
      key: "time",
      header: tAudit("time"),
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums">{dateTimeFormat.format(row.createdAt)}</span>
      ),
    },
    { key: "action", header: tAudit("action"), cell: (row) => <code className="font-mono text-xs">{row.action}</code> },
    {
      key: "actorRole",
      header: tAudit("actorRole"),
      cell: (row) => (row.actorRole && isRoleKey(row.actorRole) ? tCommon(`roles.${row.actorRole}`) : (row.actorRole ?? "—")),
    },
    { key: "school", header: t("filterSchool"), cell: (row) => schools.find((s) => s.id === row.schoolId)?.name ?? "—" },
    {
      key: "outcome",
      header: tAudit("outcome"),
      cell: (row) => <Badge variant={OUTCOME_BADGES[row.outcome] ?? "neutral"}>{tAudit(row.outcome)}</Badge>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <form method="get" className="grid gap-3 sm:grid-cols-5">
        <Field label={t("filterAction")}>
          <Input name="action" defaultValue={action} placeholder={t("filterActionPlaceholder")} dir="ltr" />
        </Field>
        <Field label={t("filterActor")}>
          <Input name="actorUserId" defaultValue={actorUserId} dir="ltr" />
        </Field>
        <Field label={t("filterSchool")}>
          <Select name="schoolId" defaultValue={schoolId}>
            <option value="">{t("allSchools")}</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("filterFrom")}>
          <Input type="date" name="from" defaultValue={from} dir="ltr" />
        </Field>
        <Field label={t("filterTo")}>
          <Input type="date" name="to" defaultValue={to} dir="ltr" />
        </Field>
        <div className="flex items-end gap-2 sm:col-span-5">
          <Button type="submit">{t("applyCta")}</Button>
          <a href="?" className="text-sm font-semibold text-ink-muted hover:text-ink">
            {t("resetCta")}
          </a>
        </div>
      </form>

      <DataTable columns={columns} rows={logs} rowKey={(row) => row.id} emptyMessage={tAudit("empty")} />
    </div>
  );
}
