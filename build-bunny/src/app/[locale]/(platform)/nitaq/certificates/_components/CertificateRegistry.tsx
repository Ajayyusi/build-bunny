"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Badge, Button, Dialog, useToast } from "@/ui";

import { revokeCertificateAction } from "../actions";

export interface CertificateRowVM {
  id: string;
  schoolName: string;
  studentName: string;
  title: string;
  serial: string;
  verifySlug: string;
  issuedAt: string;
  revoked: boolean;
  revokedAt: string | null;
  revokeReason: string | null;
}

/**
 * The registry table plus the revoke flow.
 *
 * Revoking is destructive to a child's recognition, so it takes a confirm
 * step and a typed reason rather than a single click — and the row stays in
 * the table afterwards, marked, because a revoked certificate must keep
 * resolving at its public URL. A serial that 404s is indistinguishable from
 * a forged one.
 */
export function CertificateRegistry({ rows }: { rows: CertificateRowVM[] }) {
  const t = useTranslations("platform.certificates");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<CertificateRowVM | null>(null);
  const [reason, setReason] = useState("");

  const close = () => {
    setTarget(null);
    setReason("");
  };

  const confirm = () => {
    if (target === null || reason.trim().length < 3) return;
    startTransition(async () => {
      const result = await revokeCertificateAction({
        certificateId: target.id,
        reason: reason.trim(),
      });
      if (result.ok) {
        toast({
          title: result.data.alreadyRevoked ? t("alreadyRevoked") : t("revokeDone"),
          variant: result.data.alreadyRevoked ? "neutral" : "positive",
        });
        close();
        router.refresh();
      } else {
        toast({ title: t("revokeFailed"), variant: "danger" });
      }
    });
  };

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border-token">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-token bg-surface-sunken text-start">
              <th className="p-3 text-start font-semibold text-ink">{t("colStudent")}</th>
              <th className="p-3 text-start font-semibold text-ink">{t("colSchool")}</th>
              <th className="p-3 text-start font-semibold text-ink">{t("colTitle")}</th>
              <th className="p-3 text-start font-semibold text-ink">{t("colSerial")}</th>
              <th className="p-3 text-start font-semibold text-ink">{t("colIssued")}</th>
              <th className="p-3 text-start font-semibold text-ink">{t("colStatus")}</th>
              <th className="p-3 text-end font-semibold text-ink" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border-token last:border-b-0">
                <td className="p-3 text-ink">{row.studentName}</td>
                <td className="p-3 text-ink-muted">{row.schoolName}</td>
                <td className="p-3 text-ink">{row.title}</td>
                <td className="p-3">
                  {/* Serials and slugs are codes, never prose — pinned LTR so
                      they stay readable on the Arabic console. */}
                  <span dir="ltr" className="font-mono text-xs text-ink-muted">
                    {row.serial}
                  </span>
                </td>
                <td className="p-3">
                  <span dir="ltr" className="text-ink-muted">
                    {row.issuedAt}
                  </span>
                </td>
                <td className="p-3">
                  {row.revoked ? (
                    <span className="flex flex-col gap-0.5">
                      <Badge variant="danger">{t("statusRevoked")}</Badge>
                      {row.revokeReason ? (
                        <span className="text-xs text-ink-muted">{row.revokeReason}</span>
                      ) : null}
                    </span>
                  ) : (
                    <Badge variant="positive">{t("statusValid")}</Badge>
                  )}
                </td>
                <td className="p-3 text-end">
                  <span className="flex items-center justify-end gap-2">
                    <a
                      href={`/verify/${row.verifySlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-brand hover:underline"
                    >
                      {t("verifyLink")}
                    </a>
                    {row.revoked ? null : (
                      <Button variant="secondary" size="sm" onClick={() => setTarget(row)}>
                        {t("revoke")}
                      </Button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={target !== null}
        onClose={close}
        title={t("revokeTitle")}
        closeLabel={t("cancel")}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={close} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={confirm}
              loading={pending}
              disabled={reason.trim().length < 3}
            >
              {t("revokeConfirm")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink">
            {t("revokeBody", {
              student: target?.studentName ?? "",
              title: target?.title ?? "",
            })}
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-ink">{t("reasonLabel")}</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              className="rounded-lg border border-border-token bg-surface-raised p-3 text-sm text-ink"
            />
            <span className="text-xs text-ink-muted">{t("reasonHelp")}</span>
          </label>
        </div>
      </Dialog>
    </>
  );
}
