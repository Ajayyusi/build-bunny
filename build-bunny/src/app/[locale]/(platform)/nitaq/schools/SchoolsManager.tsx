"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  Field,
  Input,
  useToast,
  type BadgeVariant,
  runAction,
  type DataTableColumn,
} from "@/ui";

import { createSchoolAction, setSchoolActiveAction } from "./actions";

export interface SchoolRow {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  _count: { studentProfiles: number; teacherProfiles: number };
  licences: { status: string; expiresAt: Date }[];
}

const LICENCE_BADGES: Record<string, BadgeVariant> = {
  ACTIVE: "positive",
  GRACE: "warning",
  READ_ONLY: "neutral",
  SUSPENDED: "danger",
};

type T = ReturnType<typeof useTranslations<"platform.schools">>;

function errorMessage(t: T, code: string): string {
  if (code === "FORBIDDEN") return t("forbidden");
  if (code === "CONFLICT") return t("conflict");
  return t("errorGeneric");
}

const TODAY = new Date().toISOString().slice(0, 10);
const NEXT_YEAR = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const EMPTY_FORM = {
  name: "",
  slug: "",
  code: "",
  timezone: "Asia/Dubai",
  licenceSeats: "100",
  licenceStartsAt: TODAY,
  licenceExpiresAt: NEXT_YEAR,
  adminName: "",
  adminEmail: "",
};

export function SchoolsManager({ schools }: { schools: SchoolRow[] }) {
  const t = useTranslations("platform.schools");
  const tLicence = useTranslations("platform.licence");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; password: string; email: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<SchoolRow | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  function openWizard() {
    setForm(EMPTY_FORM);
    setStep(1);
    setError(null);
    setCreated(null);
    setWizardOpen(true);
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const result = await runAction(() => createSchoolAction({
        name: form.name,
        slug: form.slug,
        code: form.code,
        timezone: form.timezone,
        licenceSeats: form.licenceSeats,
        licenceStartsAt: form.licenceStartsAt,
        licenceExpiresAt: form.licenceExpiresAt,
        adminEmail: form.adminEmail,
        adminDisplayName: form.adminName,
      }));
      if (!result.ok) {
        setError(errorMessage(t, result.error));
        return;
      }
      setCreated({
        name: form.name,
        password: result.data.admin.password,
        email: result.data.admin.username,
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function copyPassword() {
    if (!created) return;
    await navigator.clipboard.writeText(created.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleConfirmActive() {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    try {
      const active = confirmTarget.status !== "ACTIVE";
      const result = await runAction(() => setSchoolActiveAction({ schoolId: confirmTarget.id, active }));
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

  const step1Valid =
    form.name.trim() !== "" && form.slug.trim() !== "" && form.code.trim() !== "" && form.timezone.trim() !== "";
  const step2Valid =
    form.licenceSeats.trim() !== "" &&
    form.licenceStartsAt !== "" &&
    form.licenceExpiresAt !== "" &&
    form.adminName.trim() !== "" &&
    form.adminEmail.trim() !== "";

  const columns: DataTableColumn<SchoolRow>[] = [
    {
      key: "name",
      header: t("name"),
      cell: (row) => (
        <Link href={`/nitaq/schools/${row.id}`} className="font-medium text-brand hover:underline">
          {row.name}
        </Link>
      ),
    },
    { key: "code", header: t("code"), cell: (row) => <code dir="ltr" className="text-xs uppercase">{row.code}</code> },
    {
      key: "status",
      header: t("status"),
      cell: (row) =>
        row.status === "ACTIVE" ? (
          <Badge variant="positive">{t("statusActive")}</Badge>
        ) : (
          <Badge variant="neutral">{t("statusInactive")}</Badge>
        ),
    },
    { key: "students", header: t("students"), cell: (row) => row._count.studentProfiles, align: "end" },
    { key: "teachers", header: t("teachers"), cell: (row) => row._count.teacherProfiles, align: "end" },
    {
      key: "licence",
      header: t("licence"),
      cell: (row) => {
        const licence = row.licences[0];
        if (!licence) return <Badge variant="neutral">{tLicence("none")}</Badge>;
        return (
          <Badge variant={LICENCE_BADGES[licence.status] ?? "neutral"}>
            {tLicence(licence.status)}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (row) => (
        <Button
          variant={row.status === "ACTIVE" ? "danger" : "secondary"}
          size="sm"
          onClick={() => setConfirmTarget(row)}
        >
          {row.status === "ACTIVE" ? t("deactivateCta") : t("reactivateCta")}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={openWizard}>{t("createCta")}</Button>
      </div>

      <DataTable columns={columns} rows={schools} rowKey={(row) => row.id} emptyMessage={t("empty")} />

      <Dialog
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title={created ? t("successTitle") : t("createDialogTitle")}
        closeLabel={tCommon("close")}
        size="lg"
        footer={
          created ? (
            <Button onClick={() => setWizardOpen(false)}>{tCommon("close")}</Button>
          ) : step === 1 ? (
            <Button disabled={!step1Valid} onClick={() => setStep(2)}>
              {t("nextCta")}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep(1)}>
                {t("backCta")}
              </Button>
              <Button loading={busy} disabled={!step2Valid} onClick={handleSubmit}>
                {t("submitCta")}
              </Button>
            </>
          )
        }
      >
        {created ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink">{t("successBody", { name: created.name })}</p>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-muted">{t("fieldAdminEmail")}</span>
              <code dir="ltr" className="text-sm">
                {created.email}
              </code>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-ink">{t("successPasswordLabel")}</span>
              <div className="flex items-center gap-2">
                <code
                  dir="ltr"
                  className="flex-1 rounded-md border border-border-token bg-surface-sunken px-3 py-2 font-mono text-sm"
                >
                  {created.password}
                </code>
                <Button variant="secondary" size="sm" onClick={copyPassword}>
                  {copied ? tCommon("copied") : tCommon("copy")}
                </Button>
              </div>
            </div>
          </div>
        ) : step === 1 ? (
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-ink">{t("step1Title")}</h3>
            <Field label={t("fieldName")}>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label={t("fieldSlug")} hint={t("fieldSlugHint")}>
              <Input
                dir="ltr"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </Field>
            <Field label={t("fieldCode")} hint={t("fieldCodeHint")}>
              <Input
                dir="ltr"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </Field>
            <Field label={t("fieldTimezone")}>
              <Input
                dir="ltr"
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              />
            </Field>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-ink">{t("step2Title")}</h3>
            <Field label={t("fieldLicenceSeats")}>
              <Input
                type="number"
                dir="ltr"
                min={1}
                value={form.licenceSeats}
                onChange={(e) => setForm((f) => ({ ...f, licenceSeats: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("fieldLicenceStart")}>
                <Input
                  type="date"
                  dir="ltr"
                  value={form.licenceStartsAt}
                  onChange={(e) => setForm((f) => ({ ...f, licenceStartsAt: e.target.value }))}
                />
              </Field>
              <Field label={t("fieldLicenceEnd")}>
                <Input
                  type="date"
                  dir="ltr"
                  value={form.licenceExpiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, licenceExpiresAt: e.target.value }))}
                />
              </Field>
            </div>
            <Field label={t("fieldAdminName")}>
              <Input
                value={form.adminName}
                onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
              />
            </Field>
            <Field label={t("fieldAdminEmail")}>
              <Input
                type="email"
                dir="ltr"
                value={form.adminEmail}
                onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
              />
            </Field>
            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </Dialog>

      <Dialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        title={
          confirmTarget?.status === "ACTIVE" ? t("confirmDeactivateTitle") : t("confirmReactivateTitle")
        }
        closeLabel={tCommon("close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant={confirmTarget?.status === "ACTIVE" ? "danger" : "primary"}
              loading={confirmBusy}
              onClick={handleConfirmActive}
            >
              {t("confirmCta")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          {confirmTarget
            ? confirmTarget.status === "ACTIVE"
              ? t("confirmDeactivateBody", { name: confirmTarget.name })
              : t("confirmReactivateBody", { name: confirmTarget.name })
            : null}
        </p>
      </Dialog>
    </div>
  );
}
