"use client";

import { useTranslations } from "next-intl";

export interface CredentialSheetRow {
  displayName: string;
  username: string | null;
  password: string | null;
}

/**
 * Always mounted, invisible on screen (`hidden print:block`) — the caller
 * flips `rows` and calls window.print(); only this region survives onto the
 * page because every other chrome element carries `print:hidden`.
 */
export function CredentialSheet({
  className,
  schoolCode,
  rows,
}: {
  className: string;
  schoolCode: string;
  rows: CredentialSheetRow[];
}) {
  const t = useTranslations("staff.school.studentsPage");

  return (
    <div className="hidden print:block print:p-8">
      <h1 className="font-display text-xl font-bold text-ink">{t("sheetTitle")}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t("sheetClass", { className })}</p>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-border-token px-3 py-2 text-start">{t("columnName")}</th>
            <th className="border border-border-token px-3 py-2 text-start">{t("sheetSchoolCode")}</th>
            <th className="border border-border-token px-3 py-2 text-start">{t("sheetUsername")}</th>
            <th className="border border-border-token px-3 py-2 text-start">{t("sheetPassword")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.username ?? row.displayName} className="break-inside-avoid">
              <td className="border border-border-token px-3 py-2">{row.displayName}</td>
              <td className="border border-border-token px-3 py-2 font-mono" dir="ltr">
                {schoolCode}
              </td>
              <td className="border border-border-token px-3 py-2 font-mono" dir="ltr">
                {row.username ?? ""}
              </td>
              <td className="border border-border-token px-3 py-2 font-mono" dir="ltr">
                {row.password ?? <span className="inline-block h-4 w-24 border-b border-ink" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-xs text-ink-muted">{t("sheetPrintNote")}</p>
    </div>
  );
}
