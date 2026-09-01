/**
 * Shared CSV export helpers (plan §1.2 / M5 analytics & reports). Every
 * streamed CSV route in the app builds rows through these so formula
 * injection is neutralized in exactly one place: a cell whose text begins
 * with = + - @ gets a leading apostrophe, which spreadsheet apps render as
 * literal text instead of evaluating it as a formula (OWASP CSV injection).
 */

function csvCell(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** boolean is accepted so the privacy export can share this guard too. */
export function toCsvRow(cells: (string | number | boolean)[]): string {
  return cells.map((c) => csvCell(String(c))).join(",");
}

/** CRLF-joined body, trailing newline included — matches RFC 4180 readers. */
export function toCsvBody(rows: (string | number | boolean)[][]): string {
  return rows.map(toCsvRow).join("\r\n") + "\r\n";
}

export function csvHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  };
}
