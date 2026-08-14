import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { listImportHistory } from "@/modules/schools/server/queries";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  createDateFormat,
  DataTable,
  type DataTableColumn,
} from "@/ui";

interface Props {
  params: Promise<{ locale: string }>;
}

interface HistoryMeta {
  created?: number;
  updated?: number;
  errors?: number;
}

export default async function ImportsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SCHOOL_ADMIN");
  const [history, t] = await Promise.all([
    listImportHistory(ctx),
    getTranslations("staff.school.importsPage"),
  ]);

  const dateFormat = createDateFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  type Row = (typeof history)[number];
  const columns: DataTableColumn<Row>[] = [
    {
      key: "time",
      header: t("columnTime"),
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums">
          {dateFormat.format(row.createdAt)}
        </span>
      ),
    },
    {
      key: "created",
      header: t("columnCreated"),
      cell: (row) => <span className="tabular-nums">{(row.meta as HistoryMeta | null)?.created ?? 0}</span>,
      align: "end",
    },
    {
      key: "updated",
      header: t("columnUpdated"),
      cell: (row) => <span className="tabular-nums">{(row.meta as HistoryMeta | null)?.updated ?? 0}</span>,
      align: "end",
    },
    {
      key: "errors",
      header: t("columnErrors"),
      cell: (row) => <span className="tabular-nums">{(row.meta as HistoryMeta | null)?.errors ?? 0}</span>,
      align: "end",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-bold text-ink">{t("title")}</h1>
          <p className="text-sm text-ink-muted">{t("subtitle")}</p>
        </div>
        <Link href="/school/imports/new">
          <Button>{t("newCta")}</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("historyHeading")}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <DataTable
            columns={columns}
            rows={history}
            rowKey={(row) => row.id}
            emptyMessage={t("historyEmpty")}
            className="rounded-none border-0"
          />
        </CardBody>
      </Card>
    </div>
  );
}
