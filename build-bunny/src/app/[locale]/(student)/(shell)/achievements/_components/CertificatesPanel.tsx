"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { CertificateSheet, type CertificateSheetLabels } from "@/modules/certificates/CertificateSheet";
import { Button } from "@/ui";

export interface CertificateVM {
  id: string;
  title: string;
  issuedAtText: string;
  starsLine: string;
  serial: string;
  verifyUrl: string;
  studentName: string;
  schoolName: string;
  revoked: boolean;
}

interface Props {
  certificates: CertificateVM[];
  locale: string;
  labels: CertificateSheetLabels;
}

/**
 * The certificate list + print overlay (m4 task 5). "Print / Save as PDF"
 * opens the CertificateSheet full-size and calls window.print() — the
 * @media print rule in globals.css (scoped to .certificate-sheet) hides
 * everything else on the page, so no bespoke print layout is needed here.
 */
export function CertificatesPanel({ certificates, locale, labels }: Props) {
  const t = useTranslations("student.achievements");
  const tCert = useTranslations("certificates");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = certificates.find((c) => c.id === openId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {certificates.map((cert) => (
          <li
            key={cert.id}
            className="flex flex-col gap-2 rounded-lg border border-border-token bg-surface-raised p-4 shadow-soft"
          >
            <div className="flex items-start gap-3">
              <span aria-hidden className="text-2xl">
                🎓
              </span>
              <div className="flex min-w-0 flex-col">
                <p className="truncate font-display text-base font-bold text-ink">
                  {cert.title}
                </p>
                <p className="text-sm text-ink-muted">
                  {cert.revoked
                    ? t("certificateRevoked")
                    : t("certificateIssuedOn", { date: cert.issuedAtText })}
                </p>
              </div>
            </div>
            {!cert.revoked ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setOpenId(cert.id)}
                className="self-start"
              >
                {t("viewCertificate")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.title}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-ink/50 p-4 print:static print:bg-transparent print:p-0"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpenId(null);
          }}
        >
          <div className="flex w-full max-w-4xl items-center justify-end gap-2 print:hidden">
            <Button size="sm" onClick={() => window.print()}>
              {tCert("print")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setOpenId(null)}>
              {tCert("close")}
            </Button>
          </div>
          <CertificateSheet
            studentName={open.studentName}
            schoolName={open.schoolName}
            title={open.title}
            issuedAtText={open.issuedAtText}
            serial={open.serial}
            starsLine={open.starsLine}
            verifyUrl={open.verifyUrl}
            locale={locale}
            labels={labels}
          />
        </div>
      ) : null}
    </>
  );
}
