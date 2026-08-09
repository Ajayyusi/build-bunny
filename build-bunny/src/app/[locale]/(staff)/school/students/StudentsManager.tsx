"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  Field,
  Input,
  Select,
  useToast,
  type DataTableColumn,
} from "@/ui";

import {
  createStudentAction,
  resetClassPasswordsAction,
  resetStudentPasswordAction,
  setStudentDisabledAction,
} from "./actions";
import { CredentialSheet, type CredentialSheetRow } from "./CredentialSheet";

export interface StudentRow {
  id: string;
  displayName: string;
  displayUsername: string | null;
  banned: boolean | null;
  studentProfile: {
    studentIdentifier: string;
    grade: number;
    xpTotal: number;
    starsTotal: number;
  } | null;
  classMemberships: { class: { id: string; name: string } }[];
}

export interface ClassOption {
  id: string;
  name: string;
}

type T = ReturnType<typeof useTranslations<"staff.school.studentsPage">>;

function errorMessage(t: T, code: string): string {
  if (code === "FORBIDDEN") return t("forbidden");
  if (code === "CONFLICT") return t("conflict");
  return t("errorGeneric");
}

const EMPTY_ADD_FORM = {
  displayName: "",
  username: "",
  studentIdentifier: "",
  grade: "",
  classId: "",
};

export function StudentsManager({
  students,
  classes,
  schoolCode,
  activeClassId,
  activeClassName,
}: {
  students: StudentRow[];
  classes: ClassOption[];
  schoolCode: string;
  activeClassId: string;
  activeClassName: string;
}) {
  const t = useTranslations("staff.school.studentsPage");
  const tCommon = useTranslations("common");
  const tSchool = useTranslations("staff.school");
  const router = useRouter();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<StudentRow | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [printRows, setPrintRows] = useState<CredentialSheetRow[]>([]);

  function openAdd() {
    setAddForm({ ...EMPTY_ADD_FORM, classId: activeClassId });
    setAddError(null);
    setAddOpen(true);
  }

  async function handleCreate() {
    setAddBusy(true);
    setAddError(null);
    try {
      const result = await createStudentAction({
        username: addForm.username,
        displayName: addForm.displayName,
        studentIdentifier: addForm.studentIdentifier,
        grade: addForm.grade,
        classId: addForm.classId || undefined,
      });
      if (!result.ok) {
        setAddError(errorMessage(t, result.error));
        return;
      }
      setAddOpen(false);
      setCredentials({ username: result.data.username, password: result.data.password });
      router.refresh();
    } finally {
      setAddBusy(false);
    }
  }

  async function handleReset(row: StudentRow) {
    setRowBusy(row.id);
    setRowError(null);
    try {
      const result = await resetStudentPasswordAction({ userId: row.id });
      if (!result.ok) {
        setRowError(errorMessage(t, result.error));
        return;
      }
      setCredentials({ username: row.displayUsername ?? "", password: result.data.password });
    } finally {
      setRowBusy(null);
    }
  }

  async function handleConfirmDisable() {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    try {
      const disabled = !confirmTarget.banned;
      const result = await setStudentDisabledAction({ userId: confirmTarget.id, disabled });
      if (!result.ok) {
        toast({ title: errorMessage(t, result.error), variant: "danger" });
        return;
      }
      setConfirmTarget(null);
      router.refresh();
    } finally {
      setConfirmBusy(false);
    }
  }

  async function copyPassword() {
    if (!credentials) return;
    await navigator.clipboard.writeText(credentials.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function printNow() {
    setSheetOpen(false);
    // Let the print rows commit to the DOM before invoking the browser dialog.
    requestAnimationFrame(() => window.print());
  }

  function handlePrintBlank() {
    setPrintRows(
      students.map((s) => ({
        displayName: s.displayName,
        username: s.displayUsername,
        password: null,
      })),
    );
    printNow();
  }

  async function handlePrintReset() {
    setSheetBusy(true);
    setSheetError(null);
    try {
      const result = await resetClassPasswordsAction({ classId: activeClassId });
      if (!result.ok) {
        setSheetError(errorMessage(t, result.error));
        return;
      }
      setPrintRows(
        result.data.map((r) => ({
          displayName: r.displayName,
          username: r.username,
          password: r.password,
        })),
      );
      printNow();
      router.refresh();
    } finally {
      setSheetBusy(false);
    }
  }

  const columns: DataTableColumn<StudentRow>[] = [
    {
      key: "name",
      header: t("columnName"),
      cell: (row) => <span className="font-medium text-ink">{row.displayName}</span>,
    },
    {
      key: "username",
      header: t("columnUsername"),
      cell: (row) => (
        <code dir="ltr" className="text-xs">
          {row.displayUsername ?? "—"}
        </code>
      ),
    },
    {
      key: "id",
      header: t("columnId"),
      cell: (row) => row.studentProfile?.studentIdentifier ?? "—",
    },
    {
      key: "class",
      header: t("columnClass"),
      cell: (row) => row.classMemberships.map((m) => m.class.name).join(", ") || t("noClass"),
    },
    {
      key: "grade",
      header: t("columnGrade"),
      cell: (row) => (
        <span className="tabular-nums">{row.studentProfile?.grade ?? "—"}</span>
      ),
      align: "end",
    },
    {
      key: "xp",
      header: t("columnXp"),
      cell: (row) => <span className="tabular-nums">{row.studentProfile?.xpTotal ?? 0}</span>,
      align: "end",
    },
    {
      key: "status",
      header: t("columnStatus"),
      cell: (row) =>
        row.banned ? (
          <Badge variant="danger">{tSchool("statusDisabled")}</Badge>
        ) : (
          <Badge variant="positive">{tSchool("statusActive")}</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={rowBusy === row.id}
            disabled={rowBusy !== null}
            onClick={() => handleReset(row)}
          >
            {t("resetCta")}
          </Button>
          <Button
            variant={row.banned ? "secondary" : "danger"}
            size="sm"
            disabled={rowBusy !== null}
            onClick={() => setConfirmTarget(row)}
          >
            {row.banned ? t("reactivateCta") : t("deactivateCta")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
    <div className="flex flex-col gap-4 print:hidden">
      <div className="flex flex-wrap justify-end gap-2">
        {activeClassId ? (
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            {t("credentialSheetCta")}
          </Button>
        ) : (
          <span className="self-center text-sm text-ink-muted">
            {t("credentialSheetNeedsClass")}
          </span>
        )}
        <Button onClick={openAdd}>{t("addCta")}</Button>
      </div>

      {rowError ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {rowError}
        </p>
      ) : null}

      <DataTable columns={columns} rows={students} rowKey={(row) => row.id} emptyMessage={t("empty")} />

      {/* Add student */}
      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t("addDialogTitle")}
        closeLabel={tCommon("close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              loading={addBusy}
              disabled={
                addForm.displayName.trim() === "" ||
                addForm.username.trim() === "" ||
                addForm.studentIdentifier.trim() === "" ||
                addForm.grade.trim() === ""
              }
              onClick={handleCreate}
            >
              {t("submitCta")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t("fieldDisplayName")}>
            <Input
              autoComplete="off"
              value={addForm.displayName}
              onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))}
            />
          </Field>
          <Field label={t("fieldUsername")} hint={t("fieldUsernameHint", { code: schoolCode })}>
            <Input
              dir="ltr"
              autoComplete="off"
              value={addForm.username}
              onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
            />
          </Field>
          <Field label={t("fieldStudentId")}>
            <Input
              dir="ltr"
              autoComplete="off"
              value={addForm.studentIdentifier}
              onChange={(e) => setAddForm((f) => ({ ...f, studentIdentifier: e.target.value }))}
            />
          </Field>
          <Field label={t("fieldGrade")}>
            <Input
              type="number"
              min={1}
              max={12}
              dir="ltr"
              value={addForm.grade}
              onChange={(e) => setAddForm((f) => ({ ...f, grade: e.target.value }))}
            />
          </Field>
          <Field label={t("fieldClass")}>
            <Select
              value={addForm.classId}
              onChange={(e) => setAddForm((f) => ({ ...f, classId: e.target.value }))}
            >
              <option value="">{t("noClassOption")}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          {addError ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {addError}
            </p>
          ) : null}
        </div>
      </Dialog>

      {/* Password shown once */}
      <Dialog
        open={credentials !== null}
        onClose={() => {
          setCredentials(null);
          setCopied(false);
        }}
        title={t("resetDialogTitle")}
        closeLabel={tCommon("close")}
        footer={<Button onClick={() => setCredentials(null)}>{tCommon("close")}</Button>}
      >
        {credentials ? (
          <div className="flex flex-col gap-3">
            <p role="alert" className="text-sm font-medium text-warning">
              {t("resetWarning")}
            </p>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-ink">{t("resetPasswordLabel")}</span>
              <div className="flex items-center gap-2">
                <code
                  dir="ltr"
                  className="flex-1 rounded-md border border-border-token bg-surface-sunken px-3 py-2 font-mono text-sm"
                >
                  {credentials.password}
                </code>
                <Button variant="secondary" size="sm" onClick={copyPassword}>
                  {copied ? tCommon("copied") : tCommon("copy")}
                </Button>
              </div>
            </div>
            <p className="text-sm text-ink-muted">{t("resetDoneNote")}</p>
          </div>
        ) : null}
      </Dialog>

      {/* Deactivate / reactivate confirm */}
      <Dialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        title={confirmTarget?.banned ? t("confirmReactivateTitle") : t("confirmDeactivateTitle")}
        closeLabel={tCommon("close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant={confirmTarget?.banned ? "primary" : "danger"}
              loading={confirmBusy}
              onClick={handleConfirmDisable}
            >
              {t("confirmCta")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          {confirmTarget
            ? confirmTarget.banned
              ? t("confirmReactivateBody", { name: confirmTarget.displayName })
              : t("confirmDeactivateBody", { name: confirmTarget.displayName })
            : null}
        </p>
      </Dialog>

      {/* Credential sheet options */}
      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t("credentialSheetDialogTitle", { className: activeClassName })}
        closeLabel={tCommon("close")}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-lg border border-border-token p-4">
            <p className="font-semibold text-ink">{t("credentialSheetBlankOption")}</p>
            <p className="text-sm text-ink-muted">{t("credentialSheetBlankHint")}</p>
            <Button variant="secondary" onClick={handlePrintBlank} className="self-start">
              {t("credentialSheetGenerate")}
            </Button>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/5 p-4">
            <p className="font-semibold text-ink">{t("credentialSheetResetOption")}</p>
            <p className="text-sm text-warning">{t("credentialSheetResetWarning")}</p>
            <Button
              variant="danger"
              loading={sheetBusy}
              onClick={handlePrintReset}
              className="self-start"
            >
              {t("credentialSheetGenerate")}
            </Button>
          </div>
          {sheetError ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {sheetError}
            </p>
          ) : null}
        </div>
      </Dialog>

    </div>
    <CredentialSheet className={activeClassName} schoolCode={schoolCode} rows={printRows} />
    </>
  );
}
