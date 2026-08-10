import { describe, expect, it } from "vitest";

import { toCsvBody, toCsvRow } from "@/lib/csv";

/**
 * Shared CSV export helpers (M5 analytics & reports). Formula injection is
 * the OWASP-documented CSV attack: a cell opening with = + - @ is evaluated
 * as a formula by Excel/Sheets/LibreOffice when the file is opened, which
 * can run DDE commands or leak data via a crafted HYPERLINK/WEBSERVICE call.
 * Every export route in this app builds rows through these two functions —
 * testing them here covers every route at once.
 */
describe("toCsvRow — formula-injection neutralization", () => {
  it.each([
    ["=cmd|'/C calc'!A1", "'=cmd|'/C calc'!A1"],
    ["+1+1", "'+1+1"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1:A9)", "'@SUM(A1:A9)"],
  ])("prefixes a cell starting with %s with a guarding apostrophe", (input, expected) => {
    expect(toCsvRow([input])).toBe(expected);
  });

  it("leaves ordinary text, numbers and internal punctuation untouched", () => {
    expect(toCsvRow(["Grade 3A", 75, "3-A"])).toBe("Grade 3A,75,3-A");
  });

  it("does not guard a value that merely contains = + - @ mid-string", () => {
    expect(toCsvRow(["email@example.com"])).toBe("email@example.com");
  });

  it("quotes and escapes a cell containing a comma", () => {
    expect(toCsvRow(["Doe, Jane"])).toBe('"Doe, Jane"');
  });

  it("quotes and doubles internal double-quotes", () => {
    expect(toCsvRow(['Say "hi"'])).toBe('"Say ""hi"""');
  });

  it("quotes a cell containing a newline", () => {
    expect(toCsvRow(["line one\nline two"])).toBe('"line one\nline two"');
  });

  it("guards AND quotes when a formula-injection cell also contains a comma", () => {
    // Guard is applied first, then the (now apostrophe-led) value is quoted
    // because it still contains the comma — both defenses compose.
    expect(toCsvRow(["=A1,B1"])).toBe('"\'=A1,B1"');
  });

  it("joins multiple cells with a plain comma", () => {
    expect(toCsvRow(["a", 1, "b", 2])).toBe("a,1,b,2");
  });
});

describe("toCsvBody — full document assembly", () => {
  it("CRLF-joins rows with a trailing newline (RFC 4180)", () => {
    const body = toCsvBody([
      ["name", "score"],
      ["Alpha", 10],
      ["Beta", 20],
    ]);
    expect(body).toBe("name,score\r\nAlpha,10\r\nBeta,20\r\n");
  });

  it("neutralizes formula injection across every row of a real-shaped export", () => {
    const body = toCsvBody([
      ["class_name", "completion_pct"],
      ["=cmd|'/C calc'!A1", 50],
      ["Grade 3A", 80],
    ]);
    const lines = body.trim().split("\r\n");
    expect(lines[1]).toBe("'=cmd|'/C calc'!A1,50");
    expect(lines[1]).not.toMatch(/^=cmd/);
  });
});
