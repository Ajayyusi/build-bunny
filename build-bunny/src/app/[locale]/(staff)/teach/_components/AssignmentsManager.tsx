"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { resolveText, type LocalizedText } from "@/modules/curriculum/schemas";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  useToast,
  type DataTableColumn,
} from "@/ui";

import { closeAssignment, createAssignment } from "@/modules/assignments/server/actions";

export interface AssignmentRowVM {
  id: string;
  classId: string;
  className: string;
  target: "WORLD" | "MODULE" | "LEVEL";
  targetLabel: LocalizedText;
  title: string;
  note: string | null;
  dueAt: string | null;
  closedAt: string | null;
  createdByName: string;
}

export interface AssignableLevelVM {
  id: string;
  slug: string;
  title: LocalizedText;
}
export interface AssignableModuleVM {
  id: string;
  slug: string;
  name: LocalizedText;
  levels: AssignableLevelVM[];
}
export interface AssignableWorldVM {
  id: string;
  slug: string;
  name: LocalizedText;
  modules: AssignableModuleVM[];
}

type T = ReturnType<typeof useTranslations<"staff.teach.assignments">>;

function errorMessage(t: T, code: string): string {
  if (code === "NOT_FOUND") return t("dialog.error");
  return t("dialog.error");
}

const EMPTY_FORM = {
  classId: "",
  target: "LEVEL" as "WORLD" | "MODULE" | "LEVEL",
  worldId: "",
  moduleId: "",
  levelId: "",
  title: "",
  note: "",
  dueAt: "",
};

export function AssignmentsManager({
  assignments,
  classes,
  fixedClassId,
  worlds,
  canManage,
}: {
  assignments: AssignmentRowVM[];
  classes: { id: string; name: string; grade: number }[];
  fixedClassId?: string;
  worlds: AssignableWorldVM[];
  canManage: boolean;
}) {
  const t = useTranslations("staff.teach.assignments");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, classId: fixedClassId ?? "" }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  function openDialog() {
    setForm({ ...EMPTY_FORM, classId: fixedClassId ?? classes[0]?.id ?? "" });
    setError(null);
    setOpen(true);
  }

  const selectedWorld = worlds.find((w) => w.id === form.worldId);
  const selectedModule = selectedWorld?.modules.find((m) => m.id === form.moduleId);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const result = await createAssignment({
        classId: form.classId,
        target: form.target,
        worldId: form.worldId || undefined,
        moduleId: form.target !== "WORLD" ? form.moduleId || undefined : undefined,
        levelId: form.target === "LEVEL" ? form.levelId || undefined : undefined,
        title: form.title,
        note: form.note || undefined,
        dueAt: form.dueAt ? new Date(form.dueAt) : undefined,
      });
      if (!result.ok) {
        setError(errorMessage(t, result.error));
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleClose(id: string) {
    if (!window.confirm(t("closeConfirm"))) return;
    setClosingId(id);
    try {
      const result = await closeAssignment({ assignmentId: id });
      if (!result.ok) {
        toast({ title: t("closeError"), variant: "danger" });
        return;
      }
      router.refresh();
    } finally {
      setClosingId(null);
    }
  }

  const canSubmit =
    form.classId !== "" &&
    form.title.trim() !== "" &&
    (form.target === "WORLD"
      ? form.worldId !== ""
      : form.target === "MODULE"
        ? form.moduleId !== ""
        : form.levelId !== "");

  const columns: DataTableColumn<AssignmentRowVM>[] = useMemo(() => {
    const cols: DataTableColumn<AssignmentRowVM>[] = [];
    if (!fixedClassId) {
      cols.push({ key: "class", header: t("table.class"), cell: (row) => row.className });
    }
    cols.push(
      {
        key: "target",
        header: t("table.target"),
        cell: (row) => (
          <span className="flex flex-col">
            <span className="text-xs text-ink-muted">{t(`target.${row.target}`)}</span>
            <span className="font-medium text-ink">{resolveText(row.targetLabel, locale)}</span>
          </span>
        ),
      },
      { key: "title", header: t("table.title"), cell: (row) => row.title },
      {
        key: "due",
        header: t("table.due"),
        cell: (row) =>
          row.dueAt ? (
            <span dir="ltr">{new Date(row.dueAt).toLocaleDateString(locale)}</span>
          ) : (
            <span className="text-ink-muted">{t("table.noDue")}</span>
          ),
      },
      {
        key: "status",
        header: t("table.status"),
        cell: (row) =>
          row.closedAt ? (
            <Badge variant="neutral">{t("table.closed")}</Badge>
          ) : (
            <Badge variant="positive">{t("table.open")}</Badge>
          ),
      },
    );
    if (canManage) {
      cols.push({
        key: "actions",
        header: "",
        align: "end",
        cell: (row) =>
          row.closedAt ? null : (
            <Button
              variant="secondary"
              size="sm"
              loading={closingId === row.id}
              disabled={closingId !== null}
              onClick={() => handleClose(row.id)}
            >
              {t("table.close")}
            </Button>
          ),
      });
    }
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedClassId, canManage, closingId, locale]);

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <div className="flex justify-end">
          <Button onClick={openDialog}>{t("createCta")}</Button>
        </div>
      ) : null}

      {assignments.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">📌</span>}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      ) : (
        <DataTable columns={columns} rows={assignments} rowKey={(row) => row.id} emptyMessage={t("emptyTitle")} />
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("dialog.title")}
        closeLabel={tCommon("close")}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("dialog.cancel")}
            </Button>
            <Button loading={busy} disabled={!canSubmit} onClick={handleCreate}>
              {t("dialog.submit")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {!fixedClassId ? (
            <Field label={t("dialog.classLabel")}>
              <Select
                value={form.classId}
                onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
              >
                <option value="" disabled>
                  {t("dialog.classLabel")}
                </option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field label={t("dialog.targetLabel")}>
            <Select
              value={form.target}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  target: e.target.value as "WORLD" | "MODULE" | "LEVEL",
                  moduleId: "",
                  levelId: "",
                }))
              }
            >
              <option value="WORLD">{t("target.WORLD")}</option>
              <option value="MODULE">{t("target.MODULE")}</option>
              <option value="LEVEL">{t("target.LEVEL")}</option>
            </Select>
          </Field>

          <Field label={t("dialog.worldLabel")}>
            <Select
              value={form.worldId}
              onChange={(e) =>
                setForm((f) => ({ ...f, worldId: e.target.value, moduleId: "", levelId: "" }))
              }
            >
              <option value="" disabled>
                {t("dialog.worldLabel")}
              </option>
              {worlds.map((world) => (
                <option key={world.id} value={world.id}>
                  {resolveText(world.name, locale)}
                </option>
              ))}
            </Select>
          </Field>

          {form.target !== "WORLD" ? (
            <Field label={t("dialog.moduleLabel")}>
              <Select
                value={form.moduleId}
                onChange={(e) => setForm((f) => ({ ...f, moduleId: e.target.value, levelId: "" }))}
                disabled={!selectedWorld}
              >
                <option value="" disabled>
                  {t("dialog.moduleLabel")}
                </option>
                {(selectedWorld?.modules ?? []).map((mod) => (
                  <option key={mod.id} value={mod.id}>
                    {resolveText(mod.name, locale)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {form.target === "LEVEL" ? (
            <Field label={t("dialog.levelLabel")}>
              <Select
                value={form.levelId}
                onChange={(e) => setForm((f) => ({ ...f, levelId: e.target.value }))}
                disabled={!selectedModule}
              >
                <option value="" disabled>
                  {t("dialog.levelLabel")}
                </option>
                {(selectedModule?.levels ?? []).map((level) => (
                  <option key={level.id} value={level.id}>
                    {resolveText(level.title, locale)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field label={t("dialog.titleLabel")}>
            <Input
              value={form.title}
              placeholder={t("dialog.titlePlaceholder")}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          <Field label={t("dialog.noteLabel")}>
            <Input
              value={form.note}
              placeholder={t("dialog.notePlaceholder")}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </Field>
          <Field label={t("dialog.dueLabel")}>
            <Input
              type="date"
              value={form.dueAt}
              onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}
