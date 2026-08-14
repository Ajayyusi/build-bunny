import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { resolveText } from "@/modules/curriculum/schemas";
import { listSchoolCertificates } from "@/modules/certificates/server/queries";
import {
  Badge,
  createDateFormat,
  DataTable,
  PageHeader,
  type DataTableColumn,
} from "@/ui";

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * The certificates module (src/modules/certificates/server/queries.ts) is
 * built by a parallel agent — listSchoolCertificates landed during this
 * task, so this reads the real registry rather than a placeholder. No
 * revoke action here: that's an issuer-side operation, not school-admin's.
 */
export default async function SchoolCertificatesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SCHOOL_ADMIN");
  const [certificates, t] = await Promise.all([
    listSchoolCertificates(ctx),
    getTranslations("staff.school.certificatesPage"),
  ]);

  const dateFormat = createDateFormat(locale, { dateStyle: "medium" });

  type Row = (typeof certificates)[number];
  const columns: DataTableColumn<Row>[] = [
    {
      key: "student",
      header: t("columnStudent"),
      cell: (row) => <span className="font-medium text-ink">{row.studentName}</span>,
    },
    { key: "title", header: t("columnTitle"), cell: (row) => resolveText(row.title, locale) },
    {
      key: "serial",
      header: t("columnSerial"),
      cell: (row) => (
        <code dir="ltr" className="text-xs">
          {row.serial}
        </code>
      ),
    },
    {
      key: "issuedAt",
      header: t("columnIssued"),
      cell: (row) => (
        <span className="tabular-nums">{dateFormat.format(new Date(row.issuedAt))}</span>
      ),
    },
    {
      key: "status",
      header: t("columnStatus"),
      cell: (row) =>
        row.revokedAt ? (
          <Badge variant="danger">{t("statusRevoked")}</Badge>
        ) : (
          <Badge variant="positive">{t("statusValid")}</Badge>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <DataTable
        columns={columns}
        rows={certificates}
        rowKey={(row) => row.id}
        emptyMessage={t("emptyBody")}
      />
    </div>
  );
}
