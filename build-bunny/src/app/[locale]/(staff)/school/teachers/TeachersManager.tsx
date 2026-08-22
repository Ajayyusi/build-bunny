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
  useToast,
  runAction,
  type DataTableColumn,
} from "@/ui";

import {
  createTeacherAction,
  resetTeacherPasswordAction,
  setTeacherDisabledAction,
} from "./actions";

export interface TeacherRow {
  id: string;
  displayName: string;
  email: string;
  banned: boolean | null;
  teacherProfile: { title: string | null } | null;
}

type SchoolTeachersT = ReturnType<typeof useTranslations<"staff.school.teachersPage">>;

function errorMessage(t: SchoolTeachersT, code: string): string {
  if (code === "FORBIDDEN") return t("forbidden");
  if (code === "CONFLICT") return t("conflict");
  return t("errorGeneric");
}

const EMPTY_ADD_FORM = { email: "", displayName: "", title: "" };

export function TeachersManager({ teachers }: { teachers: TeacherRow[] }) {
  const t = useTranslations("staff.school.teachersPage");
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

  const [confirmTarget, setConfirmTarget] = useState<TeacherRow | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  function openAdd() {
    setAddForm(EMPTY_ADD_FORM);
    setAddError(null);
    setAddOpen(true);
  }

  async function handleCreate() {
    setAddBusy(true);
    setAddError(null);
    try {
      const result = await runAction(() => createTeacherAction({
        email: addForm.email,
        displayName: addForm.displayName,
        title: addForm.title || undefined,
      }));
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

  async function handleReset(row: TeacherRow) {
    setRowBusy(row.id);
    setRowError(null);
    try {
      const result = await runAction(() => resetTeacherPasswordAction({ userId: row.id }));
      if (!result.ok) {
        setRowError(errorMessage(t, result.error));
        return;
      }
      setCredentials({ username: row.email, password: result.data.password });
    } finally {
      setRowBusy(null);
    }
  }

  async function handleConfirmDisable() {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    try {
      const disabled = !confirmTarget.banned;
      const result = await runAction(() => setTeacherDisabledAction({ userId: confirmTarget.id, disabled }));
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

  const columns: DataTableColumn<TeacherRow>[] = [
    {
      key: "name",
      header: t("fieldName"),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink">{row.displayName}</span>
          {row.teacherProfile?.title ? (
            <span className="text-xs text-ink-muted">{row.teacherProfile.title}</span>
          ) : null}
        </div>
      ),
    },
    { key: "email", header: t("fieldEmail"), cell: (row) => row.email },
    {
      key: "status",
      header: tSchool("status"),
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
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={openAdd}>{t("addCta")}</Button>
      </div>

      {rowError ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {rowError}
        </p>
      ) : null}

      <DataTable columns={columns} rows={teachers} rowKey={(row) => row.id} emptyMessage={t("empty")} />

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
              disabled={addForm.email.trim() === "" || addForm.displayName.trim() === ""}
              onClick={handleCreate}
            >
              {t("submitCta")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t("fieldEmail")}>
            <Input
              type="email"
              autoComplete="off"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
          <Field label={t("fieldName")}>
            <Input
              autoComplete="off"
              value={addForm.displayName}
              onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))}
            />
          </Field>
          <Field label={t("fieldTitle")} hint={t("fieldTitleHint")}>
            <Input
              autoComplete="off"
              value={addForm.title}
              onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          {addError ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {addError}
            </p>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={credentials !== null}
        // Not dismissible: this password is shown once and stored nowhere.
        // Esc or a stray backdrop click used to destroy the only copy.
        dismissible={false}
        onClose={() => {
          setCredentials(null);
          setCopied(false);
        }}
        title={t("resetDialogTitle")}
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
    </div>
  );
}
