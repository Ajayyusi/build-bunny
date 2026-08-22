"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button, Field, Input, runAction, Select, useToast } from "@/ui";

import { updateLicenceAction } from "../../actions";

export interface LicenceVM {
  id: string;
  seats: number;
  /** YYYY-MM-DD, ready for a date input. */
  startsAt: string;
  expiresAt: string;
  graceDays: number;
  status: string;
  notes: string | null;
}

const STATUSES = ["ACTIVE", "GRACE", "READ_ONLY", "SUSPENDED"] as const;

/**
 * Edit a licence: renew, extend, resize, suspend, restore.
 *
 * A licence was immutable after creation, and that one gap produced several
 * separate symptoms. `graceDays` was read by the entitlement gate on every
 * request and written by nobody, so every school got exactly 30 days
 * whatever their contract said. `status` could never leave ACTIVE, so the
 * READ_ONLY and SUSPENDED copy elsewhere in the product was unreachable
 * code. `notes` had no writer at all.
 *
 * Since enforcement now genuinely depends on these values, this is the
 * difference between a contract the product can honour and one that needs
 * hand-written SQL against production.
 *
 * Suspending is destructive in the way that matters — it ends every open
 * session in the school — so it asks first, and the confirm names the school
 * rather than saying "are you sure".
 */
export function LicenceEditor({
  licence,
  schoolName,
}: {
  licence: LicenceVM;
  schoolName: string;
}) {
  const t = useTranslations("platform.licenceEditor");
  const tStatus = useTranslations("platform.licence");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    seats: String(licence.seats),
    startsAt: licence.startsAt,
    expiresAt: licence.expiresAt,
    graceDays: String(licence.graceDays),
    status: licence.status,
    notes: licence.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = () => {
    // Ending every session in a school is not something to do on a stray
    // click, and it is invisible until someone calls to say they are locked
    // out — so the one destructive transition confirms.
    if (form.status === "SUSPENDED" && licence.status !== "SUSPENDED") {
      if (!window.confirm(t("confirmSuspend", { school: schoolName }))) return;
    }
    setError(null);
    startTransition(async () => {
      const result = await runAction(() =>
        updateLicenceAction({ licenceId: licence.id, ...form }),
      );
      if (result.ok) {
        toast({ title: t("saved"), variant: "positive" });
        setOpen(false);
        router.refresh();
      } else {
        // The server's message names the actual problem (seats below the
        // roster, dates inverted); a generic failure would send an operator
        // guessing at a commercial change.
        setError(result.message ?? t("failed"));
      }
    });
  };

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t("editCta")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border-token pt-3">
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("status")}>
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {tStatus(status)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("seats")}>
          <Input
            type="number"
            min={1}
            value={form.seats}
            onChange={(e) => set("seats", e.target.value)}
            dir="ltr"
          />
        </Field>
        <Field label={t("startsAt")}>
          <Input
            type="date"
            value={form.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
            dir="ltr"
          />
        </Field>
        <Field label={t("expiresAt")}>
          <Input
            type="date"
            value={form.expiresAt}
            onChange={(e) => set("expiresAt", e.target.value)}
            dir="ltr"
          />
        </Field>
        <Field label={t("graceDays")} hint={t("graceHint")}>
          <Input
            type="number"
            min={0}
            max={365}
            value={form.graceDays}
            onChange={(e) => set("graceDays", e.target.value)}
            dir="ltr"
          />
        </Field>
        <Field label={t("notes")}>
          <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={save} loading={pending} disabled={pending}>
          {t("saveCta")}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
          {t("cancelCta")}
        </Button>
      </div>
    </div>
  );
}
