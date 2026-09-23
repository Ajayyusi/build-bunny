"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { createAssignment } from "@/modules/assignments/server/actions";
import { Button, Dialog, Field, Input, Select, runAction } from "@/ui";

interface Props {
  worldId: string;
  moduleId: string;
  /** Module name in the page's language, used as the assignment title. */
  moduleName: string;
  classes: { id: string; name: string }[];
}

/**
 * One-step assignment from the curriculum guide: the module becomes the
 * assignment, titled with its own name, so a teacher planning from the
 * guide never has to find the same module again in the assignment form.
 * Uses the same server action (and the same "you teach this class" check)
 * as the full form.
 */
export function AssignModuleButton({ worldId, moduleId, moduleName, classes }: Props) {
  const t = useTranslations("staff.teach.curriculum.assign");
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);

  if (classes.length === 0) return null;

  async function assign() {
    setBusy(true);
    setError(false);
    try {
      const result = await runAction(() =>
        createAssignment({
          classId,
          target: "MODULE",
          worldId,
          moduleId,
          title: moduleName,
          dueAt: dueAt ? new Date(dueAt) : undefined,
        }),
      );
      if (!result.ok) {
        setError(true);
        return;
      }
      setAssignedTo(classes.find((c) => c.id === classId)?.name ?? "");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2 print:hidden">
      {assignedTo !== null ? (
        <span role="status" className="text-xs font-semibold text-positive">
          {t("done", { className: assignedTo })}
        </span>
      ) : null}
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t("button")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("title", { module: moduleName })}
        closeLabel={t("cancel")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void assign()} disabled={busy || classId === ""}>
              {t("confirm")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t("classLabel")}>
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("dueLabel")} hint={t("dueHint")}>
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {t("error")}
            </p>
          ) : null}
        </div>
      </Dialog>
    </span>
  );
}
