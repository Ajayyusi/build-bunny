import { createTranslator } from "next-intl";

import { resolveText } from "@/modules/curriculum/schemas";
import { formatDisplayDate } from "@/ui/datetime";

import ar from "../../../../messages/ar.json";
import en from "../../../../messages/en.json";

import type { ChildWeek } from "./summary";

/**
 * The two family emails, as HTML and plain text. Pure: no database, no
 * network, so the unit tests can render them directly.
 *
 * Email clients ignore stylesheets, so styles are inline, the layout is a
 * single centred column, and everything a school or teacher typed (the
 * child's name, the school's name) is escaped. Arabic gets dir="rtl".
 */

export type FamilyEmailLocale = "en" | "ar";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const messages = { en, ar } as const;

function translator(locale: FamilyEmailLocale) {
  return createTranslator({ locale, messages: messages[locale], namespace: "familyEmail" });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const INK = "#16263d";
const MUTED = "#4a5a72";
const BRAND = "#1b64c6";
const LINE = "#d9e2ee";
const FONT = "'Segoe UI', Tahoma, Arial, sans-serif";

function page(locale: FamilyEmailLocale, preheader: string, body: string): string {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const align = locale === "ar" ? "right" : "left";
  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f3f7fc;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f7fc;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:14px;">
<tr><td dir="${dir}" style="padding:28px 28px 24px;font-family:${FONT};font-size:16px;line-height:1.55;color:${INK};text-align:${align};">
<p style="margin:0 0 16px;font-weight:700;color:${BRAND};">🐰 Build Bunny</p>
${body}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;">${escapeHtml(label)}</a></p>`;
}

const muted = (text: string) =>
  `<p style="margin:12px 0 0;font-size:14px;color:${MUTED};">${text}</p>`;

/**
 * The invitation. It names the school but NOT the child: until the family
 * confirms, this address may be a typo, and a stranger must learn nothing
 * about a child from it.
 */
export function renderInviteEmail(input: {
  locale: FamilyEmailLocale;
  schoolName: string;
  confirmUrl: string;
}): RenderedEmail {
  const t = translator(input.locale);
  const school = input.schoolName;
  const subject = t("invite.subject");
  const html = page(
    input.locale,
    t("invite.body", { school }),
    `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;">${escapeHtml(t("invite.heading"))}</h1>
<p style="margin:0 0 12px;">${escapeHtml(t("invite.body", { school }))}</p>
<p style="margin:0;">${escapeHtml(t("invite.nothingYet"))}</p>
${button(input.confirmUrl, t("invite.button"))}
${muted(escapeHtml(t("invite.ignore")))}
${muted(escapeHtml(t("invite.expires")))}`,
  );
  const text = [
    t("invite.heading"),
    "",
    t("invite.body", { school }),
    t("invite.nothingYet"),
    "",
    `${t("invite.button")}: ${input.confirmUrl}`,
    "",
    t("invite.ignore"),
    t("invite.expires"),
  ].join("\n");
  return { subject, html, text };
}

/** The weekly summary: the same facts the family page shows, nothing more. */
export function renderWeeklyEmail(input: {
  locale: FamilyEmailLocale;
  week: ChildWeek;
  now: Date;
  manageUrl: string;
}): RenderedEmail {
  const { locale, week } = input;
  const t = translator(locale);
  const name = week.displayName;
  const school = week.schoolName;
  const date = formatDisplayDate(input.now, locale);
  const subject = t("weekly.subject", { name });
  const heading = t("weekly.heading", { name });
  const intro = t("weekly.intro", { school, date });

  const stats: Array<[string, number]> = [
    [t("weekly.levelsThisWeek"), week.thisWeek.levelsCompleted],
    [t("weekly.activeDays"), week.thisWeek.activeDays],
    [t("weekly.stars"), week.totals.stars],
  ];
  const statCells = stats
    .map(
      ([label, value]) =>
        `<td width="33%" valign="top" style="padding:12px 8px;border:1px solid ${LINE};border-radius:10px;text-align:center;"><div style="font-size:26px;font-weight:700;color:${BRAND};">${value}</div><div style="font-size:13px;color:${MUTED};">${escapeHtml(label)}</div></td>`,
    )
    .join(`<td width="8" style="font-size:0;">&nbsp;</td>`);

  const finished = week.thisWeek.levelTitles.map((title) => resolveText(title, locale));
  // The summary lists the latest few; say how many more there were.
  const more = week.thisWeek.levelsCompleted - finished.length;
  const moreLine = more > 0 ? t("weekly.more", { count: more }) : "";
  const learning = week.learningNow
    ? {
        title: resolveText(week.learningNow.title, locale),
        mission: week.learningNow.mission ? resolveText(week.learningNow.mission, locale) : "",
      }
    : null;
  const worlds = week.worlds
    .filter((world) => world.completed > 0)
    .map((world) => ({
      name: resolveText(world.name, locale),
      progress: t("weekly.worldProgress", { completed: world.completed, total: world.total }),
      power: world.power && world.powerEarned ? t("weekly.powerEarned", { power: resolveText(world.power.name, locale) }) : "",
      glyph: world.power?.glyph ?? "",
    }));

  const h2 = (text: string) =>
    `<h2 style="margin:24px 0 8px;font-size:17px;line-height:1.3;">${escapeHtml(text)}</h2>`;

  const html = page(
    locale,
    intro,
    `<h1 style="margin:0 0 4px;font-size:22px;line-height:1.25;">${escapeHtml(heading)}</h1>
<p style="margin:0 0 18px;font-size:14px;color:${MUTED};">${escapeHtml(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${statCells}</tr></table>
${
  learning
    ? `${h2(t("weekly.learningNow"))}<p style="margin:0;font-weight:700;">${escapeHtml(learning.title)}</p>${
        learning.mission ? `<p style="margin:2px 0 0;font-size:14px;color:${MUTED};">${escapeHtml(learning.mission)}</p>` : ""
      }`
    : ""
}
${h2(t("weekly.thisWeek"))}
${
  finished.length
    ? `<ul style="margin:0;padding-inline-start:20px;">${finished.map((title) => `<li style="margin:2px 0;">${escapeHtml(title)}</li>`).join("")}</ul>${
        moreLine ? `<p style="margin:4px 0 0;font-size:14px;color:${MUTED};">${escapeHtml(moreLine)}</p>` : ""
      }`
    : `<p style="margin:0;color:${MUTED};">${escapeHtml(t("weekly.quietWeek"))}</p>`
}
${
  worlds.length
    ? `${h2(t("weekly.worlds"))}<ul style="margin:0;padding-inline-start:20px;">${worlds
        .map(
          (world) =>
            `<li style="margin:4px 0;"><strong>${escapeHtml(world.name)}</strong> · ${escapeHtml(world.progress)}${
              world.power ? `<br><span style="font-size:14px;color:${MUTED};">${escapeHtml(`${world.glyph} ${world.power}`.trim())}</span>` : ""
            }</li>`,
        )
        .join("")}</ul>`
    : ""
}
<hr style="border:0;border-top:1px solid ${LINE};margin:28px 0 12px;">
${muted(escapeHtml(t("weekly.footer", { school })))}
${muted(`<a href="${escapeHtml(input.manageUrl)}" style="color:${BRAND};">${escapeHtml(t("weekly.stop"))}</a>`)}`,
  );

  const text = [
    heading,
    intro,
    "",
    ...stats.map(([label, value]) => `${label}: ${value}`),
    ...(learning ? ["", `${t("weekly.learningNow")}: ${learning.title}`, ...(learning.mission ? [learning.mission] : [])] : []),
    "",
    `${t("weekly.thisWeek")}:`,
    ...(finished.length ? finished.map((title) => `- ${title}`) : [t("weekly.quietWeek")]),
    ...(moreLine ? [moreLine] : []),
    ...(worlds.length
      ? ["", `${t("weekly.worlds")}:`, ...worlds.map((world) => `- ${world.name}: ${world.progress}${world.power ? ` (${world.power})` : ""}`)]
      : []),
    "",
    "--",
    t("weekly.footer", { school }),
    `${t("weekly.stop")}: ${input.manageUrl}`,
  ].join("\n");

  return { subject, html, text };
}
