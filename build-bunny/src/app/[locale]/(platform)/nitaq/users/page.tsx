import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { searchUsers } from "@/modules/schools/server/platform-queries";
import { Badge, DataTable, EmptyState, Field, Input, PageHeader, type DataTableColumn } from "@/ui";

import { ImpersonateButton } from "./ImpersonateButton";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NitaqUsersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SUPER_ADMIN", "NITAQ_ADMIN");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";

  const [results, t, tCommon] = await Promise.all([
    q.trim().length >= 2 ? searchUsers(ctx, q) : Promise.resolve([]),
    getTranslations("platform.users"),
    getTranslations("common"),
  ]);

  type Row = (typeof results)[number];
  const columns: DataTableColumn<Row>[] = [
    { key: "name", header: t("columnName"), cell: (row) => <span className="font-medium text-ink">{row.displayName}</span> },
    {
      key: "contact",
      header: t("columnContact"),
      cell: (row) => (
        <span dir="ltr" className="text-xs">
          {row.displayUsername ?? row.email}
        </span>
      ),
    },
    { key: "role", header: t("columnRole"), cell: (row) => tCommon(`roles.${row.role}`) },
    { key: "school", header: t("columnSchool"), cell: (row) => row.schoolName ?? t("noSchool") },
    {
      key: "status",
      header: t("columnStatus"),
      cell: (row) =>
        row.banned ? (
          <Badge variant="danger">{t("statusDisabled")}</Badge>
        ) : (
          <Badge variant="positive">{t("statusActive")}</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (row) => <ImpersonateButton userId={row.id} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <form method="get" className="max-w-md">
        <Field label={t("searchLabel")} hint={t("searchHint")}>
          <Input type="search" name="q" defaultValue={q} placeholder={t("searchPlaceholder")} />
        </Field>
      </form>

      {q.trim().length < 2 ? (
        <EmptyState title={t("searchLabel")} description={t("searchHint")} />
      ) : (
        <DataTable
          columns={columns}
          rows={results}
          rowKey={(row) => row.id}
          emptyMessage={t("resultsEmpty")}
        />
      )}
    </div>
  );
}
