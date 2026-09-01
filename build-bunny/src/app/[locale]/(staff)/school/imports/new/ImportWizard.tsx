"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { toCsvRow } from "@/lib/csv";
import type { CommitImportResult, ImportPlan } from "@/modules/schools/server/imports";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, DataTable, type DataTableColumn,
  runAction,
} from "@/ui";

import { commitImportAction, dryRunImportAction } from "../actions";

type T = ReturnType<typeof useTranslations<"staff.school.importsPage.wizard">>;

function errorMessage(t: T, code: string): string {
  if (code === "FORBIDDEN") return t("forbidden");
  return t("errorGeneric");
}

// Mirrors the server's MAX_CSV_BYTES cap (school/imports/actions.ts) — reject
// oversized/wrong-typed files before ever reading them into memory, not just
// after the round trip (m5 §34: "cap CSV upload size and reject non-CSV
// content types").
const MAX_CSV_BYTES = 2_000_000;

function downloadCsv(filename: string, rows: string[][]) {
  // The shared builder, because quoting alone leaves formula injection open
  // — and the error report echoes cells straight back out of a file this
  // admin was handed by someone else.
  const csv = rows.map(toCsvRow).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportWizard() {
  const t = useTranslations("staff.school.importsPage.wizard");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [csvText, setCsvText] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [validatedText, setValidatedText] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<CommitImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"validate" | "commit" | null>(null);

  function resetResults() {
    setPlan(null);
    setValidatedText(null);
    setCommitResult(null);
    setError(null);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    resetResults();
    // Browsers report inconsistent/empty `type` for .csv (Excel exports often
    // say "application/vnd.ms-excel" or ""), so the extension is the
    // reliable signal; the byte cap matches the server's hard limit exactly.
    if (!/\.csv$/i.test(file.name)) {
      setError(t("fileWrongType"));
      return;
    }
    if (file.size > MAX_CSV_BYTES) {
      setError(t("fileTooLarge"));
      return;
    }
    const text = await file.text();
    setCsvText(text);
  }

  async function handleValidate() {
    setBusy("validate");
    setError(null);
    setCommitResult(null);
    try {
      const result = await runAction(() => dryRunImportAction({ csvText }));
      if (result.ok) {
        setPlan(result.data);
        setValidatedText(csvText);
      } else {
        setError(errorMessage(t, result.error));
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleCommit() {
    setBusy("commit");
    setError(null);
    try {
      const result = await runAction(() => commitImportAction({ csvText }));
      if (result.ok) setCommitResult(result.data);
      else setError(errorMessage(t, result.error));
    } finally {
      setBusy(null);
    }
  }

  function handleDownloadCredentials() {
    if (!commitResult) return;
    downloadCsv("new-student-credentials.csv", [
      ["display_name", "username", "student_identifier", "password"],
      ...commitResult.created.map((c) => [c.displayName, c.username, c.studentIdentifier, c.password]),
    ]);
  }

  const canCommit = plan?.ok === true && validatedText === csvText && commitResult === null;

  const previewColumns: DataTableColumn<ImportPlan["rows"][number]>[] = [
    { key: "row", header: t("previewRow"), cell: (r) => <span className="tabular-nums">{r.row}</span> },
    { key: "id", header: t("previewIdentifier"), cell: (r) => <span dir="ltr">{r.studentIdentifier}</span> },
    { key: "name", header: t("previewName"), cell: (r) => `${r.firstName} ${r.lastInitial}.` },
    { key: "grade", header: t("previewGrade"), cell: (r) => r.grade ?? "—", align: "end" },
    { key: "class", header: t("previewClass"), cell: (r) => r.className },
    { key: "username", header: t("previewUsername"), cell: (r) => <span dir="ltr">{r.username ?? "—"}</span> },
    {
      key: "action",
      header: t("previewAction"),
      cell: (r) => (
        <Badge variant={r.action === "error" ? "danger" : r.action === "update" ? "warning" : "positive"}>
          {r.action === "create" ? t("actionCreate") : r.action === "update" ? t("actionUpdate") : t("actionError")}
        </Badge>
      ),
    },
    {
      key: "errors",
      header: t("previewErrors"),
      cell: (r) =>
        r.errors.length > 0 ? (
          <span className="text-xs text-danger">{r.errors.join("; ")}</span>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("contractTitle")}</CardTitle>
          <p className="text-sm text-ink-muted">{t("contractBody")}</p>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <code dir="ltr" className="block rounded-md bg-surface-sunken px-3 py-2 text-xs">
            {t("contractColumns")}
          </code>
          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              resetResults();
            }}
            rows={10}
            spellCheck={false}
            dir="ltr"
            aria-label={t("contractTitle")}
            className="w-full rounded-md border border-border-token bg-surface px-3 py-2 font-mono text-xs text-ink focus:outline-2 focus:outline-offset-1 focus:outline-brand"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy !== null}
            >
              {t("uploadCta")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="text/csv,.csv"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <span className="text-xs text-ink-muted">{t("uploadHint")}</span>
            <Button
              onClick={handleValidate}
              loading={busy === "validate"}
              disabled={busy !== null || csvText.trim() === ""}
            >
              {t("validateCta")}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {plan && !plan.ok ? (
        <Card>
          <CardBody className="flex flex-col gap-2">
            <p className="font-semibold text-danger">{t("columnErrorTitle")}</p>
            {plan.columnErrors && plan.columnErrors.unrecognized.length > 0 ? (
              <p className="text-sm text-danger">
                {t("columnErrorUnrecognized", { columns: plan.columnErrors.unrecognized.join(", ") })}
              </p>
            ) : null}
            {plan.columnErrors && plan.columnErrors.missing.length > 0 ? (
              <p className="text-sm text-danger">
                {t("columnErrorMissing", { columns: plan.columnErrors.missing.join(", ") })}
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {plan && plan.ok ? (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>{t("previewHeading")}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="positive">{t("summaryCreate", { count: plan.summary.toCreate })}</Badge>
              <Badge variant="warning">{t("summaryUpdate", { count: plan.summary.toUpdate })}</Badge>
              {plan.summary.errors > 0 ? (
                <Badge variant="danger">{t("summaryErrors", { count: plan.summary.errors })}</Badge>
              ) : null}
              <Button
                onClick={handleCommit}
                loading={busy === "commit"}
                disabled={!canCommit}
                aria-describedby={!canCommit && commitResult === null ? "import-commit-hint" : undefined}
              >
                {t("commitCta")}
              </Button>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable
              columns={previewColumns}
              rows={plan.rows}
              rowKey={(r) => String(r.row)}
              emptyMessage="—"
              stickyHeader
              className="rounded-none border-0"
            />
          </CardBody>
          {!canCommit && commitResult === null ? (
            <p id="import-commit-hint" className="px-5 pb-4 text-xs text-ink-muted">
              {t("commitDisabledHint")}
            </p>
          ) : null}
        </Card>
      ) : null}

      {commitResult ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("resultHeading")}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <p className="text-sm text-ink">{t("resultCreated", { count: commitResult.created.length })}</p>
            <p className="text-sm text-ink">{t("resultUpdated", { count: commitResult.updatedCount })}</p>
            {commitResult.created.length > 0 ? (
              <>
                <p className="text-sm font-medium text-warning">{t("credentialsNote")}</p>
                <Button variant="secondary" onClick={handleDownloadCredentials} className="self-start">
                  {t("downloadCredentialsCta")}
                </Button>
              </>
            ) : null}
            <Button onClick={() => router.push("/school/imports")} className="self-start">
              {t("doneCta")}
            </Button>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
