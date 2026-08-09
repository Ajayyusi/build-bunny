import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { verifyCertificate } from "@/modules/certificates/server/verify";
import { resolveText } from "@/modules/curriculum/schemas";
import { Badge, Card, CardBody } from "@/ui";

interface Props {
  params: Promise<{ locale: string; verifySlug: string }>;
}

/**
 * Public certificate verification (m4-contracts): NO auth, shows ONLY the
 * PublicCertificate field set. Three states — valid / revoked / not found —
 * and unknown vs. "almost right" slugs are indistinguishable (both render
 * the same neutral not-found card; verifyCertificate never leaks which).
 */
export default async function VerifyCertificatePage({ params }: Props) {
  const { locale, verifySlug } = await params;
  setRequestLocale(locale);
  const [t, tCommon, certificate] = await Promise.all([
    getTranslations("verify"),
    getTranslations("common"),
    verifyCertificate(verifySlug),
  ]);

  return (
    <div data-theme="play" className="flex min-h-dvh flex-col bg-surface text-ink">
      <header className="bb-container flex h-16 items-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-display text-lg font-bold"
        >
          <span aria-hidden>🐰</span>
          {tCommon("appName")}
        </Link>
      </header>

      <main className="bb-container flex flex-1 flex-col items-center justify-center gap-6 py-12">
        <div className="flex max-w-md flex-col items-center gap-2 text-center">
          <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
          <p className="text-ink-muted">{t("subtitle")}</p>
        </div>

        <Card className="w-full max-w-md">
          <CardBody className="flex flex-col gap-4">
            {!certificate ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span aria-hidden className="text-3xl">
                  🔍
                </span>
                <p className="font-display text-lg font-semibold">
                  {t("notFoundTitle")}
                </p>
                <p className="text-sm text-ink-muted">{t("notFoundBody")}</p>
              </div>
            ) : certificate.revoked ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span aria-hidden className="text-3xl">
                  🚫
                </span>
                <p className="font-display text-lg font-semibold">
                  {t("revokedTitle")}
                </p>
                <p className="text-sm text-ink-muted">{t("revokedBody")}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <Badge variant="positive">{t("validBadge")}</Badge>
                  <span aria-hidden className="text-2xl">
                    🏆
                  </span>
                </div>
                <dl className="flex flex-col divide-y divide-border-token">
                  <Row label={t("fields.student")} value={certificate.studentName} />
                  <Row label={t("fields.school")} value={certificate.schoolName} />
                  <Row
                    label={t("fields.achievement")}
                    value={resolveText(certificate.title, locale)}
                  />
                  <Row
                    label={t("fields.issued")}
                    value={new Intl.DateTimeFormat(locale, {
                      dateStyle: "long",
                    }).format(new Date(certificate.issuedAt))}
                  />
                  <Row label={t("fields.serial")} value={certificate.serial} mono />
                  <Row
                    label={t("fields.stars")}
                    value={String(certificate.starsEarned)}
                  />
                  <Row
                    label={t("fields.levels")}
                    value={String(certificate.levelsCount)}
                  />
                </dl>
              </>
            )}
          </CardBody>
        </Card>

        <Card className="w-full max-w-md">
          <CardBody className="flex flex-col gap-1.5">
            <h2 className="font-display text-sm font-bold">
              {t("explainerHeading")}
            </h2>
            <p className="text-sm text-ink-muted">{t("explainerBody")}</p>
          </CardBody>
        </Card>

        <Link href="/" className="text-sm font-semibold text-brand">
          {t("backLink")}
        </Link>
      </main>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd
        className={`max-w-[60%] text-end text-sm font-semibold ${mono ? "tabular-nums" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
