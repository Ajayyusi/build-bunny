import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { listPlatformCertificates } from "@/modules/certificates/server/platform-queries";
import { resolveText } from "@/modules/curriculum/schemas";
import { EmptyState, PageHeader } from "@/ui";

import { CertificateRegistry, type CertificateRowVM } from "./_components/CertificateRegistry";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; revoked?: string }>;
}

/**
 * The platform-wide certificate registry, and the only place a certificate
 * can be revoked. Revocation is issuer-side on purpose: a school admin may
 * print and verify their own certificates but may not invalidate one NITAQ
 * issued (the school certificates page says as much in its own comment).
 */
export default async function NitaqCertificatesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q, revoked } = await searchParams;
  setRequestLocale(locale);
  const ctx = await requireRole("SUPER_ADMIN", "NITAQ_ADMIN");
  const revokedOnly = revoked === "1";

  const [rows, t] = await Promise.all([
    listPlatformCertificates(ctx, { q, revokedOnly }),
    getTranslations("platform.certificates"),
  ]);

  const dateFormat = new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { dateStyle: "medium" });

  const certificates: CertificateRowVM[] = rows.map((row) => ({
    id: row.id,
    schoolName: row.schoolName,
    studentName: row.studentName,
    title: resolveText(row.title, locale),
    serial: row.serial,
    verifySlug: row.verifySlug,
    issuedAt: dateFormat.format(new Date(row.issuedAt)),
    revoked: row.revokedAt !== null,
    revokedAt: row.revokedAt === null ? null : dateFormat.format(new Date(row.revokedAt)),
    revokeReason: row.revokeReason,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-ink">{t("searchLabel")}</span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder={t("searchPlaceholder")}
            className="h-11 w-72 max-w-full rounded-lg border border-border-token bg-surface-raised px-3 text-sm text-ink"
          />
        </label>
        <label className="flex h-11 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="revoked"
            value="1"
            defaultChecked={revokedOnly}
            className="size-4"
          />
          {t("revokedOnly")}
        </label>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-strong"
        >
          {t("searchSubmit")}
        </button>
      </form>

      {certificates.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">🏅</span>}
          title={t("emptyTitle")}
          description={q || revokedOnly ? t("emptyFiltered") : t("emptyBody")}
        />
      ) : (
        <CertificateRegistry rows={certificates} />
      )}
    </div>
  );
}
