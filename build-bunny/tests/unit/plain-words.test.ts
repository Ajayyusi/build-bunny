import { describe, expect, it } from "vitest";

import { bundle } from "../../content";

/**
 * Handoff: "Do not show technical labels on the first screen unless the
 * child asks 'What is this called?'". The terms live behind that chip; a
 * level's title and mission line use plain words. ("Bias" stays: the
 * handoff itself names the activity "Find the Bias".)
 */
const TECHNICAL_AR = /مصن[ِّ]*ف|انحدار|عنقود|خوارزمي|نموذج|بيانات التدريب|الشبكة العصبية/;
const TECHNICAL = /classif|regress|cluster|k-?means|algorithm|data ?set|\bmodel|neural|training set|test set|outlier|least squares|overfit|accuracy|precision|recall|probabilit/i;

describe("plain words on the AI route", () => {
  it("no AI lesson's title or mission line uses a technical term", () => {
    const hits: string[] = [];
    for (const w of bundle.worlds) for (const m of w.modules) for (const l of m.levels) {
      if (!["AI_CLASSIFICATION", "PATTERN_RECOGNITION", "AI_SIM", "AI_ETHICS"].includes(l.activityType)) continue;
      const level = l as unknown as { title: { en: string; ar?: string }; mission?: { en: string; ar?: string } };
      for (const text of [level.title.en, level.mission?.en ?? ""]) if (TECHNICAL.test(text)) hits.push(`${l.slug}: ${text}`);
      for (const text of [level.title.ar ?? "", level.mission?.ar ?? ""]) if (TECHNICAL_AR.test(text)) hits.push(`${l.slug}: ${text}`);
    }
    expect(hits).toEqual([]);
  });
});
