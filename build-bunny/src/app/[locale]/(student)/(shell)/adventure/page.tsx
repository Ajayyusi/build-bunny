import { getTranslations, setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { MusicScene } from "@/modules/audio/scene";
import { requireRole } from "@/modules/auth/server/session";
import { isFeatureEnabled } from "@/modules/shared/features";
import { getMyStudentSnapshot } from "@/modules/students/server/queries";
import { EmptyState, PageHeader } from "@/ui";

import { AdventureTrail } from "./_components/AdventureTrail";
import { HorizonBand } from "./_components/HorizonBand";
import { loadRouteTrail } from "./_components/load-trail";

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Coding Lab: the programming route — Bunny Meadow, Logic Forest, Robot Lab,
 * Code City and Inventor Island. The AI worlds live in Explore AI
 * (/ai-worlds); both read the same progress, so nothing moved.
 */
export default async function CodingLabPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("STUDENT");

  const snapshot = await getMyStudentSnapshot(ctx);
  if (!isFeatureEnabled(snapshot?.school.features, "adventure")) {
    redirect({ href: "/home", locale });
  }

  const [{ state, worlds, horizon }, t] = await Promise.all([
    loadRouteTrail(ctx, locale, "coding"),
    getTranslations("student.adventure"),
  ]);

  if (!state.program || worlds.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={t("title")} />
        <EmptyState icon={<span className="text-2xl">🗺️</span>} title={t("emptyTitle")} description={t("emptyBody")} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <MusicScene track="map" />
      <PageHeader title={t("pathTitle")} description={t("pathSubtitle")} />
      <AdventureTrail worlds={worlds} userId={ctx.userId} />
      <HorizonBand worlds={horizon} />
    </div>
  );
}
