import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { getMyStudentSnapshot } from "@/modules/students/server/queries";
import { Avatar, Card, CardBody, CardFooter, PageHeader } from "@/ui";

import { LocaleSwitcher } from "../../../_components/LocaleSwitcher";
import { SignOutButton } from "../../../_components/SignOutButton";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function StudentProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("STUDENT");
  const [snapshot, t] = await Promise.all([
    getMyStudentSnapshot(ctx),
    getTranslations("student.profile"),
  ]);
  const displayName = snapshot?.user.displayName ?? ctx.displayName;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} />
      <Card className="max-w-2xl">
        <CardBody className="flex items-center gap-4">
          <Avatar displayName={displayName} size="lg" />
          <div className="flex min-w-0 flex-col">
            <p className="truncate font-display text-xl font-bold">
              {displayName}
            </p>
            {snapshot?.user.displayUsername ? (
              <p className="truncate text-sm text-ink-muted">
                {snapshot.user.displayUsername}
              </p>
            ) : null}
          </div>
        </CardBody>
        <dl className="divide-y divide-border-token border-t border-border-token">
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <dt className="text-sm font-medium text-ink-muted">
              {t("username")}
            </dt>
            <dd className="text-sm font-semibold">
              {snapshot?.user.displayUsername ?? "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <dt className="text-sm font-medium text-ink-muted">{t("school")}</dt>
            <dd className="text-sm font-semibold">
              {snapshot?.school.name ?? "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <dt className="text-sm font-medium text-ink-muted">{t("grade")}</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {snapshot?.grade ?? "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <dt className="text-sm font-medium text-ink-muted">
              {t("language")}
            </dt>
            <dd>
              <LocaleSwitcher size="lg" />
            </dd>
          </div>
        </dl>
        <CardFooter>
          <SignOutButton variant="secondary" size="lg" />
        </CardFooter>
      </Card>
    </div>
  );
}
