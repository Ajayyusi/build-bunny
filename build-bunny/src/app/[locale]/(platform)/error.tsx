"use client";

import { useTranslations } from "next-intl";

import { Button, ErrorState } from "@/ui";

export default function PlatformError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  return (
    <ErrorState
      title={t("boundaryTitle")}
      description={t("boundaryBody")}
      action={<Button onClick={reset}>{t("retry")}</Button>}
      className="my-8"
    />
  );
}
