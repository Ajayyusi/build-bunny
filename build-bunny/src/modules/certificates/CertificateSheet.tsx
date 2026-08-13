import type { Locale } from "@/i18n/routing";
import { NitaqLogo } from "@/ui/BrandLogo";
import { schoolFontVariable } from "@/ui/fonts";

import { encodeQr, QR_QUIET_ZONE_MODULES } from "./qr";

/**
 * The printable certificate (m4 task contract): A4 landscape, NITAQ Academy +
 * Build Bunny branding, elegant/restrained (hard rule 4 — no gradient walls,
 * no glassmorphism), credible printed in colour AND greyscale. Deliberately
 * a plain presentational component (no "use client", no data fetching, no
 * next-intl hook) so it can be rendered from either a server page or a
 * client preview/print overlay — the caller resolves every string via
 * next-intl and passes it in already localized.
 *
 * Download = the browser's native print-to-PDF ("Print / Save as PDF"
 * button + @media print below) — no server PDF dependency in V1. A4
 * landscape is fixed via `@page` in the print rules; on screen the sheet
 * scales to its container so a preview overlay can show it at any size.
 */

export interface CertificateSheetLabels {
  kicker: string;
  presentedTo: string;
  completedPrefix: string;
  verifyHeading: string;
  verifyHint: string;
  brand: string;
}

export interface CertificateSheetProps {
  studentName: string;
  schoolName: string;
  /** Resolved (already localized) achievement title, e.g. a world's name. */
  title: string;
  /** Fully formatted, localized issue date text (no further i18n needed here). */
  issuedAtText: string;
  serial: string;
  /** Fully formatted "N stars across M levels" text, already pluralized. */
  starsLine: string;
  /** Absolute URL encoded into the QR and shown as plain text underneath it. */
  verifyUrl: string;
  locale: string;
  labels: CertificateSheetLabels;
  className?: string;
}

function QrCode({ url }: { url: string }) {
  const matrix = encodeQr(url);
  const dim = matrix.size + QR_QUIET_ZONE_MODULES * 2;
  const rects: string[] = [];
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (matrix.modules[r]![c]) {
        rects.push(`M${c + QR_QUIET_ZONE_MODULES},${r + QR_QUIET_ZONE_MODULES}h1v1h-1z`);
      }
    }
  }
  return (
    <svg
      viewBox={`0 0 ${dim} ${dim}`}
      role="img"
      aria-label={url}
      className="size-24 shrink-0 print:size-28"
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      <path d={rects.join(" ")} fill="#1b1a17" />
    </svg>
  );
}

export function CertificateSheet({
  studentName,
  schoolName,
  title,
  issuedAtText,
  serial,
  starsLine,
  verifyUrl,
  locale,
  labels,
  className,
}: CertificateSheetProps) {
  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-theme="play"
      className={`certificate-sheet relative isolate mx-auto flex aspect-[297/210] w-full max-w-[1050px] flex-col overflow-hidden border-2 border-brand-strong bg-surface-raised p-[3.5%] text-ink print:aspect-auto print:h-[210mm] print:w-[297mm] print:max-w-none print:border print:p-[12mm] ${schoolFontVariable(locale as Locale)} ${className ?? ""}`}
    >
      {/* Restrained frame: a single hairline set inside the border — no
          gradients, no ornamental clutter, reads fine in pure greyscale. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[10px] border border-border-token print:inset-[6mm]"
      />

      <header className="flex items-start justify-between gap-4">
        {/* NITAQ is the primary institutional mark here — brand decision —
            with Build Bunny as the secondary product credit beside it. The
            logo is decorative (aria-hidden) because "NITAQ Academy" is
            already present as visible text right next to it. */}
        <div className="flex items-center gap-3">
          <NitaqLogo size="sm" decorative className="max-h-9 w-auto print:max-h-11" />
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              NITAQ Academy
            </span>
            <span className="font-display text-sm font-bold tracking-wide text-ink">
              Build Bunny
            </span>
          </div>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
          {labels.kicker}
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-3 py-2 text-center">
        <p className="text-sm text-ink-muted">{labels.presentedTo}</p>
        <p className="font-display text-4xl font-bold text-ink">{studentName}</p>
        <p className="max-w-xl text-sm text-ink-muted">
          {labels.completedPrefix} <span className="font-semibold text-ink">{title}</span>
        </p>
        <p className="text-sm font-semibold text-brand">{schoolName}</p>
        <p className="text-xs text-ink-muted">{starsLine}</p>
      </main>

      <footer className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-0.5 text-start text-xs text-ink-muted">
          <span>{issuedAtText}</span>
          <span className="tabular-nums">{serial}</span>
          <span className="mt-1 font-semibold text-ink">{labels.brand}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-0.5 text-end text-[10px] text-ink-muted">
            <span className="font-semibold text-ink">{labels.verifyHeading}</span>
            <span>{labels.verifyHint}</span>
            <span className="max-w-[16ch] break-all tabular-nums" dir="ltr">
              {verifyUrl}
            </span>
          </div>
          <QrCode url={verifyUrl} />
        </div>
      </footer>
    </div>
  );
}
