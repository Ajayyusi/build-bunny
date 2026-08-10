import { getTranslations, setRequestLocale } from "next-intl/server";

import { env } from "@/lib/env";
import { requireRole } from "@/modules/auth/server/session";
import { listMyCertificates } from "@/modules/certificates/server/queries";
import { resolveText } from "@/modules/curriculum/schemas";
import {
  getMyAchievements,
  getMyClassLeaderboard,
} from "@/modules/students/server/queries";
import { EmptyState, PageHeader } from "@/ui";

import { CertificatesPanel, type CertificateVM } from "./_components/CertificatesPanel";
import { Leaderboard } from "./_components/Leaderboard";

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

  const [badges, certificates, leaderboard, t, tCert] = await Promise.all([
    getMyAchievements(ctx),
    listMyCertificates(ctx),
    getMyClassLeaderboard(ctx),
    getTranslations("student.achievements"),
    getTranslations("certificates"),
  ]);

  const earnedCount = badges.filter((b) => b.earnedAt !== null).length;
  const badgePct =
    badges.length === 0
      ? 0
      : Math.round((earnedCount / badges.length) * 100);
  const me = leaderboard.find((row) => row.isMe) ?? null;

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

      {/* Legacy hero + class leaderboard */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bb-cascade relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-strong to-info p-6 text-on-brand">
          <span
            aria-hidden="true"
            className="bb-twinkle pointer-events-none absolute -bottom-6 end-2 text-[140px] leading-none opacity-25"
          >
            🏅
          </span>
          <div className="relative flex flex-col gap-3">
            <h2 className="font-display text-2xl font-bold">
              {t("legacyTitle")}
            </h2>
            <p className="max-w-sm text-sm opacity-90">
              {t("legacyBody", { pct: badgePct })}
            </p>

            <div className="mt-1 max-w-sm">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide opacity-90">
                <span>{t("legacyProgressLabel")}</span>
                <span className="tabular-nums">{badgePct}%</span>
              </div>
              <span className="mt-1.5 block h-2 w-full overflow-hidden rounded-full bg-on-brand/25">
                <span
                  aria-hidden="true"
                  className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
                  style={{ width: `${badgePct}%` }}
                />
              </span>
            </div>

            <dl className="mt-3 flex gap-8">
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide opacity-80">
                  {t("rank")}
                </dt>
                <dd className="font-display text-xl font-bold tabular-nums">
                  {me ? `#${me.rank}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide opacity-80">
                  {t("badgesCount")}
                </dt>
                <dd className="font-display text-xl font-bold tabular-nums">
                  {earnedCount}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <Leaderboard
          rows={leaderboard}
          title={t("leaderboardTitle")}
          hint={t("leaderboardHint")}
          emptyText={t("leaderboardEmpty")}
          youLabel={t("leaderboardYou")}
          xpLabel={(value) => t("xpSuffix", { value })}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-ink">{t("badgesHeading")}</h2>
        {badges.length === 0 ? (
          <EmptyState
            icon={<span className="text-2xl">🏅</span>}
            title={t("badgesEmptyTitle")}
            description={t("badgesEmptyBody")}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {badges.map((badge, i) => {
              const earned = badge.earnedAt !== null;
              return (
                <li
                  key={badge.slug}
                  style={{ "--i": i } as React.CSSProperties}
                  className={`bb-cascade flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center ${
                    earned
                      ? "border-border-token bg-surface-raised shadow-soft"
                      : "border-dashed border-border-token bg-surface-sunken"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`grid size-14 place-items-center rounded-full text-3xl ${
                      earned
                        ? "bg-accent/20"
                        : "bg-surface-raised opacity-40 grayscale"
                    }`}
                  >
                    {earned ? badge.icon : "🔒"}
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
