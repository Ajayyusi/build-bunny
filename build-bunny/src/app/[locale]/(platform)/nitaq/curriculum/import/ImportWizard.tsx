"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { ImportDiff } from "@/modules/curriculum/server/import";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle } from "@/ui";

import {
  commitImportAction,
  dryRunImportAction,
  loadBundledContentAction,
} from "../actions";

/**
 * Three-step import wizard: provide a JSON bundle (paste, file, or the
 * compiled-in content), dry-run to see the exact diff, then commit. The
 * commit button only arms after a dry-run of the CURRENT text — editing the
 * bundle disarms it again.
 */
export function ImportWizard() {
  const t = useTranslations("platform.curriculum.import");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bundleJson, setBundleJson] = useState("");
  const [dryRun, setDryRun] = useState<ImportDiff | null>(null);
  const [commitResult, setCommitResult] = useState<ImportDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"load" | "dryRun" | "commit" | null>(null);

  function resetResults() {
    setDryRun(null);
    setCommitResult(null);
    setError(null);
  }

  function errorMessage(code: string): string {
    return code === "FORBIDDEN" ? t("forbidden") : t("errorGeneric");
  }

  async function handleLoadBundled() {
    setBusy("load");
    setError(null);
    try {
      const result = await loadBundledContentAction({});
      if (result.ok) {
        setBundleJson(result.data.bundleJson);
        setDryRun(null);
        setCommitResult(null);
      } else {
        setError(errorMessage(result.error));
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setBundleJson(text);
    resetResults();
  }

  async function handleDryRun() {
    setBusy("dryRun");
    setError(null);
    setCommitResult(null);
    try {
      const result = await dryRunImportAction({ bundleJson });
      if (result.ok) setDryRun(result.data);
      else setError(errorMessage(result.error));
    } finally {
      setBusy(null);
    }
  }

  async function handleCommit() {
    setBusy("commit");
    setError(null);
    try {
      const result = await commitImportAction({ bundleJson });
      if (result.ok) setCommitResult(result.data);
      else setError(errorMessage(result.error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("bundleLabel")}</CardTitle>
          <p className="text-sm text-ink-muted">{t("bundleHint")}</p>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <textarea
            value={bundleJson}
            onChange={(event) => {
              setBundleJson(event.target.value);
              resetResults();
            }}
            rows={12}
            spellCheck={false}
            dir="ltr"
            aria-label={t("bundleLabel")}
            className="w-full rounded-md border border-border-token bg-surface px-3 py-2 font-mono text-xs text-ink focus:outline-2 focus:outline-offset-1 focus:outline-brand"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleLoadBundled}
              loading={busy === "load"}
              disabled={busy !== null}
            >
              {t("loadBundled")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy !== null}
            >
              {t("loadFile")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <Button
              onClick={handleDryRun}
              loading={busy === "dryRun"}
              disabled={busy !== null || bundleJson.trim().length === 0}
            >
              {t("dryRun")}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {dryRun ? (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>{t("dryRunHeading")}</CardTitle>
            <Button
              onClick={handleCommit}
              loading={busy === "commit"}
              disabled={busy !== null || commitResult !== null}
            >
              {t("commit")}
            </Button>
          </CardHeader>
          <CardBody>
            <DiffReport diff={dryRun} />
          </CardBody>
        </Card>
      ) : null}

      {commitResult ? (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>{t("commitHeading")}</CardTitle>
            <Badge variant="positive">{t("commitDone")}</Badge>
          </CardHeader>
          <CardBody>
            <DiffReport diff={commitResult} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function DiffReport({ diff }: { diff: ImportDiff }) {
  const t = useTranslations("platform.curriculum.import");
  const groups = [
    { key: "groupCreates", entries: diff.creates, variant: "positive" as const },
    { key: "groupUpdates", entries: diff.updates, variant: "warning" as const },
    { key: "groupUnchanged", entries: diff.unchanged, variant: "neutral" as const },
    { key: "groupIssues", entries: diff.issues, variant: "danger" as const },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">{t(group.key)}</span>
            <Badge variant={group.variant}>{group.entries.length}</Badge>
          </div>
          {group.entries.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("none")}</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto rounded-md border border-border-token bg-surface-sunken p-2">
              {group.entries.map((entry) => (
                <li key={entry} className="font-mono text-xs leading-6 text-ink" dir="ltr">
                  {entry}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
