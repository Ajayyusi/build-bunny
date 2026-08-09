"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button, ErrorState } from "@/ui";

export default function PlayLevelError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  const tPlay = useTranslations("student.play");

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <ErrorState
        title={t("boundaryTitle")}
        description={t("boundaryBody")}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="lg" onClick={reset}>
              {t("retry")}
            </Button>
            <Link
              href="/adventure"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border-token bg-surface-raised px-5 text-base font-semibold text-ink transition-colors hover:bg-surface-sunken"
            >
              {tPlay("backToMap")}
            </Link>
          </div>
        }
      />
    </div>
  );
}
