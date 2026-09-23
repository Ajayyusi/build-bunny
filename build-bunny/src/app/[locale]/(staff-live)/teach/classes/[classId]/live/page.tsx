import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { getClassMatrix } from "@/modules/analytics/server/queries";
import { buildLiveSnapshot } from "@/modules/analytics/live";
import { ErrorState } from "@/ui";

import { LiveView } from "./_components/LiveView";

interface Props {
  params: Promise<{ locale: string; classId: string }>;
  searchParams: Promise<{ challenge?: string }>;
}

export default async function ClassLivePage({ params, searchParams }: Props) {
  const { locale, classId } = await params;
  const { challenge } = await searchParams;
  setRequestLocale(locale);
  const ctx = await requireRole("TEACHER", "SCHOOL_ADMIN");
  const [matrix, t] = await Promise.all([
    getClassMatrix(ctx, classId),
    getTranslations("staff.teach.matrix"),
  ]);

  if (!matrix) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-8">
        <ErrorState title={t("notFoundTitle")} description={t("notFoundBody")} />
      </div>
    );
  }

  const initial = buildLiveSnapshot(matrix, locale, challenge ?? null);
  return <LiveView classId={classId} locale={locale} initial={initial} />;
}
