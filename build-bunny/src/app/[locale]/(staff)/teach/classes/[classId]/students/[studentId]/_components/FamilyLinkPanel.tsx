"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { createFamilyLink, revokeFamilyLink } from "@/modules/family/server/actions";
import { Badge, Button, Card, CardBody, formatDisplayDate, runAction, useToast } from "@/ui";

interface Props {
  studentUserId: string;
  studentName: string;
  status: { active: boolean; expiresAt: string | null; lastViewedAt: string | null };
}

/**
 * The teacher's side of the family view: create (or replace) the child's
 * private read-only link, copy it once, or switch it off. The full link is
 * only ever in this component's state after "Create" — the server keeps a
 * hash, so a reload shows the status and offers a new link, never the old.
 */
export function FamilyLinkPanel({ studentUserId, studentName, status }: Props) {
  const t = useTranslations("staff.teach.student.family");
  const locale = useLocale();
  const { toast } = useToast();
  const [active, setActive] = useState(status.active);
  const [expiresAt, setExpiresAt] = useState(status.expiresAt);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const result = await runAction(() => createFamilyLinkAction({ studentUserId }));
      if (!result.ok) {
        toast({ title: t("error"), variant: "danger" });
        return;
      }
      setLink(`${window.location.origin}/${locale}/family/${result.data.token}`);
      setActive(true);
      setExpiresAt(new Date(result.data.expiresAt).toISOString());
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      const result = await runAction(() => revokeFamilyLinkAction({ studentUserId }));
      if (!result.ok) {
        toast({ title: t("error"), variant: "danger" });
        return;
      }
      setLink(null);
      setActive(false);
      setExpiresAt(null);
      toast({ title: t("revoked") });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: t("copied") });
    } catch {
      toast({ title: t("copyFailed"), variant: "danger" });
    }
  };

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-ink">{t("heading")}</h2>
          {active ? (
            <Badge variant="positive">{t("activeBadge")}</Badge>
          ) : (
            <Badge variant="neutral">{t("noneBadge")}</Badge>
          )}
        </div>
        <p className="text-sm text-ink-muted">{t("body", { name: studentName })}</p>
        {active && expiresAt ? (
          <p className="text-sm text-ink-muted">
            {t("expires", { date: formatDisplayDate(new Date(expiresAt), locale) })}
            {status.lastViewedAt && !link
              ? ` · ${t("lastViewed", { date: formatDisplayDate(new Date(status.lastViewedAt), locale) })}`
              : ""}
          </p>
        ) : null}
        {link ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border-token bg-surface-sunken p-3">
            <label htmlFor="family-link" className="text-sm font-semibold text-ink">
              {t("linkLabel")}
            </label>
            <input
              id="family-link"
              readOnly
              value={link}
              dir="ltr"
              onFocus={(event) => event.currentTarget.select()}
              className="h-11 w-full rounded-md border border-border-token bg-surface px-3 text-sm text-ink"
            />
            <p className="text-xs text-ink-muted">{t("onceNote")}</p>
            <Button variant="secondary" onClick={copy} className="w-fit">
              {t("copy")}
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={create} loading={busy} disabled={busy}>
            {active ? t("replace") : t("create")}
          </Button>
          {active ? (
            <Button variant="secondary" onClick={revoke} disabled={busy}>
              {t("revoke")}
            </Button>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

// Named with the Action suffix so the transport guard sees them wrapped.
const createFamilyLinkAction = createFamilyLink;
const revokeFamilyLinkAction = revokeFamilyLink;
