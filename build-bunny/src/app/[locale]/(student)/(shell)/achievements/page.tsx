import { getTranslations, setRequestLocale } from "next-intl/server";

import { env } from "@/lib/env";
import { requireRole } from "@/modules/auth/server/session";
import { listMyCertificates } from "@/modules/certificates/server/queries";
import { resolveText } from "@/modules/curriculum/schemas";
import { getMyAchievements } from "@/modules/students/server/queries";
import { EmptyState, PageHeader } from "@/ui";

import { CertificatesPanel, type CertificateVM } from "./_components/CertificatesPanel";

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Achievements (m4 task 5): earned + locked badges, and certificates earned
 * with a print/save action. Achievement.description already IS the
 * child-friendly "how to earn this" copy (prisma/seed-data/achievements.ts)
 * — locked badges reuse it verbatim as their criteria hint.
 */
export default async function AchievementsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("STUDENT");

  const [badges, certificates, t, tCert] = await Promise.all([
    getMyAchievements(ctx),
    listMyCertificates(ctx),
    getTranslations("student.achievements"),
    getTranslations("certificates"),
  ]);

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  const certificateVMs: CertificateVM[] = certificates.map((cert) => ({
    id: cert.id,
    title: resolveText(cert.title, locale),
    issuedAtText: dateFormatter.format(new Date(cert.issuedAt)),
    starsLine: tCert("starsLine", { stars: cert.starsEarned, levels: cert.levelsCount }),
    serial: cert.serial,
    verifyUrl: `${env.NEXT_PUBLIC_APP_URL}/verify/${cert.verifySlug}`,
    studentName: cert.studentName,
    schoolName: cert.schoolName,
    revoked: cert.revokedAt !== null,
  }));

  const sheetLabels = {
    kicker: tCert("sheet.kicker"),
    presentedTo: tCert("sheet.presentedTo"),
    completedPrefix: tCert("sheet.completedPrefix"),
    verifyHeading: tCert("sheet.verifyHeading"),
    verifyHint: tCert("sheet.verifyHint"),
    brand: tCert("sheet.brand"),
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-ink">{t("badgesHeading")}</h2>
        {badges.length === 0 ? (
          <EmptyState
            icon={<span className="text-2xl">🏅</span>}
            title={t("badgesEmptyTitle")}
            description={t("badgesEmptyBody")}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {badges.map((badge) => {
              const earned = badge.earnedAt !== null;
              return (
                <li
                  key={badge.slug}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-4 text-center ${
                    earned
                      ? "border-border-token bg-surface-raised shadow-soft"
                      : "border-dashed border-border-token bg-surface-sunken"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`text-3xl ${earned ? "" : "opacity-30 grayscale"}`}
                  >
                    {badge.icon}
                  </span>
                  <p
                    className={`font-display text-sm font-bold ${earned ? "text-ink" : "text-ink-faint"}`}
                  >
                    {resolveText(badge.name, locale)}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {earned
                      ? t("earnedOn", { date: dateFormatter.format(new Date(badge.earnedAt!)) })
                      : resolveText(badge.description, locale)}
                  </p>
                  {!earned ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                      {t("lockedLabel")}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-ink">
          {t("certificatesHeading")}
        </h2>
        {certificateVMs.length === 0 ? (
          <EmptyState
            icon={<span className="text-2xl">🎓</span>}
            title={t("certificatesEmptyTitle")}
            description={t("certificatesEmptyBody")}
          />
        ) : (
          <CertificatesPanel certificates={certificateVMs} locale={locale} labels={sheetLabels} />
        )}
      </section>
    </div>
  );
}
