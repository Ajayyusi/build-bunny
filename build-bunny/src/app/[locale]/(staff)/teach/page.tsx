import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { listMyClasses } from "@/modules/schools/server/queries";
import { Badge, Card, CardBody, EmptyState, PageHeader } from "@/ui";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function TeachPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("TEACHER", "SCHOOL_ADMIN");
  const [classes, t, tCommon] = await Promise.all([
    listMyClasses(ctx),
    getTranslations("staff.teach"),
    getTranslations("common"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {classes.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">📚</span>}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardBody className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 truncate font-display text-lg font-semibold text-ink">
                    {cls.name}
                  </h2>
                  <Badge variant="brand" className="shrink-0">
                    {tCommon("grade", { grade: String(cls.grade) })}
                  </Badge>
                </div>
                <p className="text-sm text-ink-muted">
                  {t("studentCount", {
                    count: cls._count.memberships,
                    displayCount: String(cls._count.memberships),
                  })}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
