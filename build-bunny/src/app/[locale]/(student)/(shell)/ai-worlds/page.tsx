import { getTranslations, setRequestLocale } from "next-intl/server";
import { AiSurface } from "../../_components/AiSurface";

import { Link, redirect } from "@/i18n/navigation";
import { MusicScene } from "@/modules/audio/scene";
import { requireRole } from "@/modules/auth/server/session";
import { isFeatureEnabled } from "@/modules/shared/features";
import { getMyStudentSnapshot } from "@/modules/students/server/queries";
import { EmptyState, PageHeader } from "@/ui";

import { AdventureTrail } from "../adventure/_components/AdventureTrail";
import { loadRouteTrail } from "../adventure/_components/load-trail";

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * The AI route's worlds — AI Island, Data Desert and the Machine Learning
 * Lab — as their own trail inside Explore AI. They open without any coding
 * (the unlock engine chains AI worlds only to each other).
 */
// A sibling of /explore, not /explore/worlds: nested under the Explore AI
// page, client navigation between the two hung in production builds (the
// link was followed, the payload arrived, the page never changed). The same
// page at a sibling URL navigates normally both ways.
export default async function AiWorldsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("STUDENT");
  const snapshot = await getMyStudentSnapshot(ctx);
  if (!isFeatureEnabled(snapshot?.school.features, "adventure")) {
    redirect({ href: "/home", locale });
  }
  const [{ state, worlds }, t] = await Promise.all([
    loadRouteTrail(ctx, locale, "ai"),
    getTranslations("student.explore.worlds"),
  ]);

  return (
    <AiSurface className="flex flex-col gap-6">
      <MusicScene track="map" />
      <Link href="/explore" className="w-fit text-sm font-semibold text-brand underline-offset-4 hover:underline">
        <span aria-hidden="true" className="rtl:hidden">
          ←{" "}
        </span>
        <span aria-hidden="true" className="hidden rtl:inline">
          →{" "}
        </span>
        {t("back")}
      </Link>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {!state.program || worlds.length === 0 ? (
        <EmptyState icon={<span className="text-2xl">🧠</span>} title={t("title")} description={t("empty")} />
      ) : (
        <AdventureTrail worlds={worlds} userId={ctx.userId} />
      )}
    </AiSurface>
  );
}
