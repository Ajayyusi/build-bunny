"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import type { GateResult } from "@/modules/curriculum/server/publish";
import { Button } from "@/ui";

import { publishLevelAction } from "../../actions";

/**
 * Runs the real publish (gates + snapshot) and reports the outcome inline:
 * success shows the new version, failure lists exactly which gates blocked
 * it. A refresh re-renders the server-side gate panel and status badge.
 */
export function PublishButton({ levelId }: { levelId: string }) {
  const t = useTranslations("platform.curriculum.level");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failedGates, setFailedGates] = useState<GateResult[] | null>(null);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setBusy(true);
    setError(null);
    setFailedGates(null);
    setPublishedVersion(null);
    try {
      const result = await publishLevelAction({ levelId });
      if (!result.ok) {
        setError(result.error === "FORBIDDEN" ? t("forbidden") : t("errorGeneric"));
        return;
      }
      if (result.data.ok && result.data.version !== undefined) {
        setPublishedVersion(result.data.version);
        router.refresh();
      } else {
        setFailedGates(result.data.gates.filter((gate) => !gate.ok));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handlePublish} loading={busy}>
        {t("publish")}
      </Button>
      {publishedVersion !== null ? (
        <p className="text-sm font-medium text-positive">
          {t("publishSuccess", { version: publishedVersion })}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      {failedGates && failedGates.length > 0 ? (
        <div role="alert" className="max-w-sm rounded-md bg-danger/10 p-3 text-sm">
          <p className="font-semibold text-danger">{t("publishBlocked")}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {failedGates.map((gate) => (
              <li key={gate.gate} className="text-danger">
                <span className="font-mono text-xs" dir="ltr">
                  {gate.gate}
                </span>
                {gate.issues.length > 0 ? ` — ${gate.issues.join("; ")}` : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
