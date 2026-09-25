import { describe, expect, it } from "vitest";

import { escapeHtml, renderInviteEmail, renderWeeklyEmail } from "@/modules/family/server/email-render";
import type { ChildWeek } from "@/modules/family/server/summary";

/**
 * The family emails render from names a school typed, so they must escape
 * everything, read right-to-left in Arabic, and keep the child unnamed in
 * the invitation.
 */

const week = (overrides: Partial<ChildWeek> = {}): ChildWeek => ({
  displayName: "Sara <b>K.</b>",
  schoolName: "Al Noor & Sons",
  weekStart: new Date("2026-09-17T12:00:00Z"),
  thisWeek: { levelsCompleted: 2, activeDays: 3, levelTitles: [{ en: "Two Hops", ar: "قفزتان" }, { en: "Loop <3" }] },
  totals: { levelsCompleted: 9, stars: 21 },
  worlds: [
    { name: { en: "Bunny Meadow", ar: "مرج الأرنب" }, completed: 9, total: 12, power: { name: { en: "Power of Order" }, glyph: "🔢" }, powerEarned: false },
    { name: { en: "Logic Forest" }, completed: 0, total: 14, power: null, powerEarned: false },
  ],
  learningNow: { title: { en: "Carrot Row" }, mission: { en: "Collect every carrot" } },
  ...overrides,
});

const NOW = new Date("2026-09-24T12:00:00Z");

describe("weekly family email", () => {
  it("escapes everything a school typed", () => {
    const email = renderWeeklyEmail({ locale: "en", week: week(), now: NOW, manageUrl: "https://x.example/en/family/email/t" });
    expect(email.html).not.toContain("<b>K.</b>");
    expect(email.html).toContain("Sara &lt;b&gt;K.&lt;/b&gt;");
    expect(email.html).toContain("Al Noor &amp; Sons");
    expect(email.html).toContain("Loop &lt;3");
    // The subject and the text part are plain text, not HTML.
    expect(email.subject).toBe("Sara <b>K.</b>'s week in Build Bunny");
    expect(email.text).toContain("Loop <3");
  });

  it("carries the week, what they're learning now, and a stop link", () => {
    const email = renderWeeklyEmail({ locale: "en", week: week(), now: NOW, manageUrl: "https://x.example/en/family/email/t" });
    for (const part of [email.html, email.text]) {
      expect(part).toContain("Two Hops");
      expect(part).toContain("Carrot Row");
      expect(part).toContain("Bunny Meadow");
      expect(part).toContain("https://x.example/en/family/email/t");
    }
    expect(email.text).toContain("Levels finished this week: 2");
    expect(email.text).not.toContain("more");
    const busy = renderWeeklyEmail({
      locale: "en",
      week: week({ thisWeek: { levelsCompleted: 9, activeDays: 4, levelTitles: [{ en: "A" }, { en: "B" }] } }),
      now: NOW,
      manageUrl: "https://x.example/m",
    });
    expect(busy.text).toContain("…and 7 more");
    // Worlds not yet started are left out.
    expect(email.text).not.toContain("Logic Forest");
  });

  it("reads right to left in Arabic, with Arabic titles where they exist", () => {
    const email = renderWeeklyEmail({ locale: "ar", week: week(), now: NOW, manageUrl: "https://x.example/ar/family/email/t" });
    expect(email.html).toContain('dir="rtl"');
    expect(email.html).toContain('lang="ar"');
    expect(email.text).toContain("قفزتان");
    expect(email.text).toContain("مرج الأرنب");
    // A title with no Arabic falls back to English rather than going blank.
    expect(email.text).toContain("Carrot Row");
    expect(email.subject).toContain("Build Bunny");
  });

  it("says so kindly when nothing was finished", () => {
    const quiet = week({ thisWeek: { levelsCompleted: 0, activeDays: 1, levelTitles: [] } });
    const email = renderWeeklyEmail({ locale: "en", week: quiet, now: NOW, manageUrl: "https://x.example/m" });
    expect(email.text).toContain("No levels finished this week");
  });
});

describe("invitation", () => {
  it("names the school, never the child, and links to confirm", () => {
    const email = renderInviteEmail({ locale: "en", schoolName: "Al Noor & Sons", confirmUrl: "https://x.example/c?a=1&b=2" });
    expect(email.html).toContain("Al Noor &amp; Sons");
    expect(email.html).toContain('href="https://x.example/c?a=1&amp;b=2"');
    expect(email.text).toContain("https://x.example/c?a=1&b=2");
    expect(email.text).toContain("Nothing about your child is sent until you confirm.");
    const ar = renderInviteEmail({ locale: "ar", schoolName: "مدرسة النور", confirmUrl: "https://x.example/c" });
    expect(ar.html).toContain('dir="rtl"');
    expect(ar.text).toContain("مدرسة النور");
  });

  it("escapes quotes and angle brackets", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
