"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import {
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
  addStudentToClassAction,
  createClassAction,
  getClassRosterAction,
  removeStudentFromClassAction,
  rotateJoinCodeAction,
  updateClassAction,
  type ClassDetail,
} from "./actions";

export interface ClassRow {
  id: string;
  name: string;
  grade: number;
  joinCode: string | null;
  academicYear: { id: string; name: string; isActive: boolean };
  _count: { memberships: number };
}

export interface AcademicYearOption {
  id: string;
  name: string;
}

export interface TeacherOption {
  id: string;
  displayName: string;
}

export interface StudentOption {
  id: string;
  displayName: string;
  displayUsername: string | null;
}

type T = ReturnType<typeof useTranslations<"staff.school.classesPage">>;

function errorMessage(t: T, code: string): string {
  if (code === "FORBIDDEN") return t("forbidden");
  if (code === "CONFLICT") return t("conflict");
  return t("errorGeneric");
}

const EMPTY_FORM = {
  name: "",
  grade: "",
  academicYearId: "",
  newYearName: "",
  newYearStart: "",
  newYearEnd: "",
  teacherUserId: "",
};

export function ClassesManager({
  classes,
  academicYears,
  teachers,
  students,
}: {
  classes: ClassRow[];
  academicYears: AcademicYearOption[];
  teachers: TeacherOption[];
  students: StudentOption[];
}) {
  const t = useTranslations("staff.school.classesPage");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [useNewYear, setUseNewYear] = useState(academicYears.length === 0);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<ClassRow | null>(null);
  const [editForm, setEditForm] = useState({ name: "", grade: "", teacherUserId: "" });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [rosterTarget, setRosterTarget] = useState<ClassRow | null>(null);
  const [roster, setRoster] = useState<ClassDetail | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterQuery, setRosterQuery] = useState("");
  const [rosterBusy, setRosterBusy] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotateBusy, setRotateBusy] = useState(false);

  function openAdd() {
    setForm(EMPTY_FORM);
    setUseNewYear(academicYears.length === 0);
    setAddError(null);
    setAddOpen(true);
  }

  async function handleCreate() {
    setAddBusy(true);
    setAddError(null);
    try {
      const result = await createClassAction({
        name: form.name,
        grade: form.grade,
        academicYearId: useNewYear ? undefined : form.academicYearId || undefined,
        newYearName: useNewYear ? form.newYearName : undefined,
        newYearStart: useNewYear ? form.newYearStart : undefined,
        newYearEnd: useNewYear ? form.newYearEnd : undefined,
        teacherUserId: form.teacherUserId || undefined,
      });
      if (!result.ok) {
        setAddError(errorMessage(t, result.error));
        return;
      }
      setAddOpen(false);
      router.refresh();
    } finally {
      setAddBusy(false);
    }
  }

  function openEdit(row: ClassRow) {
    setEditTarget(row);
    setEditForm({ name: row.name, grade: String(row.grade), teacherUserId: "" });
    setEditError(null);
  }

  async function handleEdit() {
    if (!editTarget) return;
    setEditBusy(true);
    setEditError(null);
    try {
      const result = await updateClassAction({
        classId: editTarget.id,
        name: editForm.name,
        grade: editForm.grade,
      });
      if (!result.ok) {
        setEditError(errorMessage(t, result.error));
        return;
      }
      setEditTarget(null);
      router.refresh();
    } finally {
      setEditBusy(false);
    }
  }

  async function openRoster(row: ClassRow) {
    setRosterTarget(row);
    setRoster(null);
    setRosterQuery("");
    setRosterLoading(true);
    try {
      const result = await getClassRosterAction({ classId: row.id });
      if (result.ok) setRoster(result.data);
      else toast({ title: errorMessage(t, result.error), variant: "danger" });
    } finally {
      setRosterLoading(false);
    }
  }

  async function refreshRoster() {
    if (!rosterTarget) return;
    const result = await getClassRosterAction({ classId: rosterTarget.id });
    if (result.ok) setRoster(result.data);
  }

  async function handleRotateJoinCode() {
    if (!rosterTarget) return;
    setRotateBusy(true);
    try {
      const result = await rotateJoinCodeAction({ classId: rosterTarget.id });
      if (result.ok) {
        router.refresh();
        await refreshRoster();
        setConfirmRotate(false);
      } else {
        toast({ title: errorMessage(t, result.error), variant: "danger" });
      }
    } finally {
      setRotateBusy(false);
    }
  }

  async function handleAddStudent(studentUserId: string) {
    if (!rosterTarget) return;
    setRosterBusy(studentUserId);
    try {
      const result = await addStudentToClassAction({
        classId: rosterTarget.id,
        studentUserId,
      });
      if (result.ok) {
        await refreshRoster();
        router.refresh();
      } else {
        toast({ title: errorMessage(t, result.error), variant: "danger" });
      }
    } finally {
      setRosterBusy(null);
    }
  }

  async function handleRemoveStudent(studentUserId: string) {
    if (!rosterTarget) return;
    setRosterBusy(studentUserId);
    try {
      const result = await removeStudentFromClassAction({
        classId: rosterTarget.id,
        studentUserId,
      });
      if (result.ok) {
        await refreshRoster();
        router.refresh();
      } else {
        toast({ title: errorMessage(t, result.error), variant: "danger" });
      }
    } finally {
      setRosterBusy(null);
    }
  }

  const rosterMemberIds = useMemo(
    () => new Set((roster?.memberships ?? []).filter((m) => m.role === "STUDENT").map((m) => m.user.id)),
    [roster],
  );
  const rosterCandidates = useMemo(() => {
    const q = rosterQuery.trim().toLowerCase();
    return students
      .filter((s) => !rosterMemberIds.has(s.id))
      .filter((s) => q === "" || s.displayName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [students, rosterMemberIds, rosterQuery]);

  const columns: DataTableColumn<ClassRow>[] = [
    { key: "name", header: t("fieldName"), cell: (row) => <span className="font-medium text-ink">{row.name}</span> },
    {
      key: "grade",
      header: t("fieldGrade"),
      cell: (row) => <span className="tabular-nums">{row.grade}</span>,
      align: "end",
    },
    {
      key: "year",
      header: t("fieldYear"),
      cell: (row) => <span dir="ltr">{row.academicYear.name}</span>,
    },
    {
      key: "students",
      header: t("columnStudents"),
      cell: (row) => <span className="tabular-nums">{row._count.memberships}</span>,
      align: "end",
    },
    {
      key: "joinCode",
      header: t("joinCodeLabel"),
      cell: (row) =>
        row.joinCode ? (
          <code dir="ltr" className="text-xs">
            {row.joinCode}
          </code>
        ) : (
          <span className="text-ink-muted">{t("noJoinCode")}</span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => openEdit(row)}>
            {t("editCta")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => openRoster(row)}>
            {t("rosterCta")}
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

      <DataTable columns={columns} rows={classes} rowKey={(row) => row.id} emptyMessage={t("empty")} />

      {/* Create class */}
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
                form.name.trim() === "" ||
                form.grade.trim() === "" ||
                (useNewYear
                  ? form.newYearName.trim() === "" || !form.newYearStart || !form.newYearEnd
                  : form.academicYearId === "")
              }
              onClick={handleCreate}
            >
              {t("submitCta")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t("fieldName")}>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label={t("fieldGrade")}>
            <Input
              type="number"
              min={1}
              max={12}
              dir="ltr"
              value={form.grade}
              onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
            />
          </Field>
          {academicYears.length > 0 ? (
            <Field label={t("fieldYear")}>
              <Select
                value={useNewYear ? "__new__" : form.academicYearId}
                onChange={(e) => {
                  if (e.target.value === "__new__") setUseNewYear(true);
                  else {
                    setUseNewYear(false);
                    setForm((f) => ({ ...f, academicYearId: e.target.value }));
                  }
                }}
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
                <option value="__new__">{t("newYearOption")}</option>
              </Select>
            </Field>
          ) : null}
          {useNewYear ? (
            <div className="flex flex-col gap-3 rounded-md border border-border-token p-3">
              <Field label={t("fieldNewYearName")} hint={t("fieldNewYearNameHint")}>
                <Input
                  dir="ltr"
                  value={form.newYearName}
                  onChange={(e) => setForm((f) => ({ ...f, newYearName: e.target.value }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("fieldNewYearStart")}>
                  <Input
                    type="date"
                    dir="ltr"
                    value={form.newYearStart}
                    onChange={(e) => setForm((f) => ({ ...f, newYearStart: e.target.value }))}
                  />
                </Field>
                <Field label={t("fieldNewYearEnd")}>
                  <Input
                    type="date"
                    dir="ltr"
                    value={form.newYearEnd}
                    onChange={(e) => setForm((f) => ({ ...f, newYearEnd: e.target.value }))}
                  />
                </Field>
              </div>
            </div>
          ) : null}
          <Field label={t("fieldTeacher")}>
            <Select
              value={form.teacherUserId}
              onChange={(e) => setForm((f) => ({ ...f, teacherUserId: e.target.value }))}
            >
              <option value="">{t("noTeacherOption")}</option>
              {teachers.map((tch) => (
                <option key={tch.id} value={tch.id}>
                  {tch.displayName}
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

      {/* Edit class */}
      <Dialog
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={t("editDialogTitle")}
        closeLabel={tCommon("close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button loading={editBusy} onClick={handleEdit}>
              {t("saveCta")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t("fieldName")}>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label={t("fieldGrade")}>
            <Input
              type="number"
              min={1}
              max={12}
              dir="ltr"
              value={editForm.grade}
              onChange={(e) => setEditForm((f) => ({ ...f, grade: e.target.value }))}
            />
          </Field>
          {editError ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {editError}
            </p>
          ) : null}
        </div>
      </Dialog>

      {/* Roster management */}
      <Dialog
        open={rosterTarget !== null}
        onClose={() => setRosterTarget(null)}
        title={t("rosterDialogTitle", { className: rosterTarget?.name ?? "" })}
        closeLabel={tCommon("close")}
        size="lg"
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border-token p-3">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-ink-muted">{t("joinCodeLabel")}</span>
              <code dir="ltr" className="text-sm">
                {roster?.joinCode ?? t("noJoinCode")}
              </code>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setConfirmRotate(true)}>
              {t("rotateJoinCodeCta")}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">{t("rosterCurrentHeading")}</h3>
            {rosterLoading ? (
              <p className="text-sm text-ink-muted">…</p>
            ) : (roster?.memberships.filter((m) => m.role === "STUDENT").length ?? 0) === 0 ? (
              <p className="text-sm text-ink-muted">{t("rosterEmpty")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border-token rounded-md border border-border-token">
                {roster!.memberships
                  .filter((m) => m.role === "STUDENT")
                  .map((m) => (
                    <li key={m.user.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-sm text-ink">{m.user.displayName}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={rosterBusy === m.user.id}
                        disabled={rosterBusy !== null}
                        onClick={() => handleRemoveStudent(m.user.id)}
                      >
                        {t("removeCta")}
                      </Button>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">{t("rosterAddHeading")}</h3>
            <Input
              value={rosterQuery}
              onChange={(e) => setRosterQuery(e.target.value)}
              placeholder={t("rosterAddPlaceholder")}
            />
            {rosterQuery.trim() !== "" && rosterCandidates.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border-token rounded-md border border-border-token">
                {rosterCandidates.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-sm text-ink">{s.displayName}</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={rosterBusy === s.id}
                      disabled={rosterBusy !== null}
                      onClick={() => handleAddStudent(s.id)}
                    >
                      {t("addStudentCta")}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </Dialog>

      <Dialog
        open={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        title={t("rotateJoinCodeCta")}
        closeLabel={tCommon("close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRotate(false)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="danger" loading={rotateBusy} onClick={handleRotateJoinCode}>
              {t("confirmCta") /* reused from create/deactivate flows */}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">{t("rotateJoinCodeConfirm")}</p>
      </Dialog>
    </div>
  );
}
