import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { EmptyState, PageHeader } from "@/ui";

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * The certificates module (src/modules/certificates/server/*, including any
 * revoke mutation) is being built by a parallel agent and did not exist in
 * this worktree at the time this page was written — honest empty state
 * rather than a duplicated/invented registry+revoke implementation.
 */
export default async function NitaqCertificatesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("SUPER_ADMIN", "NITAQ_ADMIN");
  const t = await getTranslations("platform.certificates");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <EmptyState icon={<span className="text-2xl">🏅</span>} title={t("emptyTitle")} description={t("emptyBody")} />
    </div>
  );
}
