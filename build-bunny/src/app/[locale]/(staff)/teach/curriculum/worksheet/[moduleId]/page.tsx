import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { resolveText } from "@/modules/curriculum/schemas";
import { getModuleWorksheet, type WorksheetItem } from "@/modules/curriculum/server/queries";

import { PrintButton } from "../../../_components/PrintButton";

interface Props {
  params: Promise<{ locale: string; moduleId: string }>;
  searchParams: Promise<{ answers?: string }>;
}

// The same pictures the game's maze designer and map use.
const TILE: Record<string, string> = { "#": "🪨", C: "🥕", G: "🕳️", W: "🌊", ".": "" };
const ARROW: Record<string, string> = { N: "↑", E: "→", S: "↓", W: "←" };
/** Step labels: A, B, C… in English; أ، ب، ج… on Arabic sheets. */
const STEP_LETTERS: Record<string, string[]> = {
  en: "ABCDEFGH".split(""),
  ar: ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"],
};
const stepLetter = (locale: string, index: number) =>
  (STEP_LETTERS[locale] ?? STEP_LETTERS["en"]!)[index] ?? String(index + 1);

/**
 * Printable, unplugged worksheet for one module (brief §6): boards to
 * write a program for, code to read, steps to put in order. Levels that
 * need the live simulation are listed as "play on the tablet". The answer
 * key prints on its own page, only when the teacher asks for it.
 */
export default async function WorksheetPage({ params, searchParams }: Props) {
  const { locale, moduleId } = await params;
  const { answers } = await searchParams;
  setRequestLocale(locale);
  const ctx = await requireRole("TEACHER", "SCHOOL_ADMIN");
  const [sheet, t, tBlocks] = await Promise.all([
    getModuleWorksheet(ctx, moduleId),
    getTranslations("staff.teach.worksheet"),
    getTranslations("student.play.blockNames"),
  ]);
  if (!sheet) notFound();
  const withAnswers = answers === "1";
  const text = (value: Parameters<typeof resolveText>[0]) => resolveText(value, locale);
  const blockName = (type: string) =>
    type === "else" ? t("elseLine") : tBlocks.has(type) ? tBlocks(type) : type;
  const list = new Intl.ListFormat(locale, { style: "short", type: "unit" });
  const paper = sheet.items.filter((item) => item.kind !== "screen");
  const screen = sheet.items.filter((item) => item.kind === "screen");

  return (
    <div className="flex flex-col gap-6 text-ink print:gap-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href="/teach/curriculum" className="text-sm font-semibold text-brand hover:underline">
          <span aria-hidden="true" className="inline-block rtl:-scale-x-100">←</span> {t("back")}
        </Link>
        <span className="ms-auto flex flex-wrap items-center gap-2">
          <Link
            href={withAnswers ? `/teach/curriculum/worksheet/${moduleId}` : `/teach/curriculum/worksheet/${moduleId}?answers=1`}
            className="inline-flex h-10 items-center rounded-md border border-border-token bg-surface-raised px-4 text-sm font-semibold hover:bg-surface-sunken"
          >
            {withAnswers ? t("hideAnswers") : t("showAnswers")}
          </Link>
          <PrintButton label={t("print")} />
        </span>
      </div>

      <header className="flex flex-col gap-1 border-b border-border-token pb-3">
        <p className="text-sm text-ink-muted">{text(sheet.worldName)}</p>
        <h1 className="font-display text-2xl font-bold">{text(sheet.moduleName)}</h1>
        {sheet.moduleDescription ? <p className="text-sm text-ink-muted">{text(sheet.moduleDescription)}</p> : null}
        <p className="mt-3 flex flex-wrap gap-x-10 gap-y-2 text-sm">
          <span>{t("nameLine")} ______________________</span>
          <span>{t("dateLine")} ____________</span>
        </p>
      </header>

      <p className="text-sm text-ink-muted" aria-label={t("legendLabel")}>
        {t("legend")}: 🐰 + → {t("legendStart")} · 🕳️ {t("legendGoal")} · 🥕 {t("legendCarrot")} · 🪨 {t("legendRock")} · 🌊 {t("legendWater")}
      </p>

      {paper.length === 0 ? <p className="text-sm">{t("noPaper")}</p> : null}

      <ol className="flex flex-col gap-6">
        {paper.map((item, index) => (
          <li key={item.levelId} className="flex flex-col gap-3 rounded-xl border border-border-token p-4 print:break-inside-avoid print:rounded-none">
            <h2 className="font-display text-lg font-bold">
              {index + 1}. {text(item.title)}
            </h2>
            <SheetItem item={item} text={text} blockName={blockName} list={list} t={t} locale={locale} />
          </li>
        ))}
      </ol>

      {screen.length > 0 ? (
        <section className="flex flex-col gap-2 print:break-inside-avoid">
          <h2 className="font-display text-base font-semibold">{t("onTablet")}</h2>
          <ul className="list-disc ps-6 text-sm">
            {screen.map((item) => (
              <li key={item.levelId}>{text(item.title)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {withAnswers ? (
        <section className="flex flex-col gap-3 border-t-2 border-ink pt-4 print:break-before-page">
          <h2 className="font-display text-xl font-bold">{t("answerKey")}</h2>
          <ol className="flex flex-col gap-2 text-sm">
            {paper.map((item, index) => (
              <li key={item.levelId}>
                <span className="font-semibold">
                  {index + 1}. {text(item.title)}:
                </span>{" "}
                {item.kind === "predict"
                  ? text(item.options.find((o) => o.id === item.answerId)?.text ?? { en: "" })
                  : item.kind === "order"
                    ? item.answer
                        .map((id) => item.items.findIndex((step) => step.id === id))
                        .map((position) => stepLetter(locale, position))
                        .join(locale === "ar" ? " ← " : " → ")
                    : t("gridAnswer")}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

type Translate = Awaited<ReturnType<typeof getTranslations<"staff.teach.worksheet">>>;

function SheetItem({
  item,
  text,
  blockName,
  list,
  t,
  locale,
}: {
  item: WorksheetItem;
  text: (value: Parameters<typeof resolveText>[0]) => string;
  blockName: (type: string) => string;
  list: Intl.ListFormat;
  t: Translate;
  locale: string;
}) {
  if (item.kind === "grid") {
    return (
      <>
        {item.mission ? <p className="text-sm">{text(item.mission)}</p> : null}
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col gap-2">
            {item.boards.length > 1 ? (
              <p className="text-xs font-semibold">{t("allBoards", { count: item.boards.length })}</p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              {item.boards.map((board, boardIndex) => (
                // The board is a map: East is always to the right, in both languages.
                <div
                  key={boardIndex}
                  dir="ltr"
                  role="img"
                  aria-label={t("boardLabel", { cols: board.rows[0]?.length ?? 0, rows: board.rows.length })}
                  className="inline-grid self-start border-2 border-ink"
                  style={{ gridTemplateColumns: `repeat(${board.rows[0]?.length ?? 1}, 2.75rem)` }}
                >
                  {board.rows.flatMap((row, y) =>
                    [...row].map((tile, x) => {
                      const isStart = board.start.x === x && board.start.y === y;
                      return (
                        <span
                          key={`${x}-${y}`}
                          className="grid size-11 place-items-center border border-ink/40 text-lg leading-none"
                        >
                          {isStart ? (
                            <span className="whitespace-nowrap text-xs font-bold">
                              🐰{ARROW[board.start.dir]}
                            </span>
                          ) : (
                            TILE[tile] ?? ""
                          )}
                        </span>
                      );
                    }),
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex min-w-56 flex-1 flex-col gap-1">
            {item.given.length > 0 ? (
              <div className="mb-2 flex flex-col gap-1">
                <p className="text-sm font-semibold">{item.debugging ? t("givenBroken") : t("givenStarter")}</p>
                <ol dir="auto" className="rounded-md border border-ink/30 p-2 font-mono text-sm">
                  {item.given.map((line, i) => (
                    <li key={i} style={{ paddingInlineStart: `${line.depth * 1.5}rem` }}>
                      {blockName(line.type)}
                      {line.condition ? ` (${blockName(line.condition)})` : ""}
                      {line.value !== undefined ? ` ${line.value}` : ""}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            <p className="text-sm font-semibold">{item.debugging ? t("writeFixed") : t("writeProgram")}</p>
            <p className="text-xs text-ink-muted">
              {t("blocksYouCanUse")}: {list.format(item.blocks.filter((b) => b !== "bb_whenStart").map(blockName))}
            </p>
            <ol className="mt-1 flex flex-col">
              {Array.from({ length: item.lines }, (_, i) => (
                <li key={i} className="flex h-8 items-end gap-2 border-b border-ink/40 text-xs text-ink-muted">
                  {i + 1}.
                </li>
              ))}
            </ol>
          </div>
        </div>
      </>
    );
  }
  if (item.kind === "predict") {
    return (
      <>
        <pre dir="ltr" className="overflow-x-auto rounded-md border border-ink/30 bg-surface-sunken p-3 text-sm print:bg-transparent">
          <code>{item.code}</code>
        </pre>
        <p className="text-sm font-semibold">{text(item.prompt)}</p>
        <ul className="flex flex-col gap-1 text-sm">
          {item.options.map((option) => (
            <li key={option.id} className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block size-4 rounded-full border-2 border-ink" />
              {text(option.text)}
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (item.kind === "order") {
    return (
      <>
        <p className="text-sm font-semibold">{text(item.prompt)}</p>
        <p className="text-xs text-ink-muted">{t("numberSteps")}</p>
        <ul className="flex flex-col gap-2 text-sm">
          {item.items.map((step, i) => (
            <li key={step.id} className="flex items-center gap-3">
              <span aria-hidden="true" className="inline-block h-7 w-9 shrink-0 border-2 border-ink" />
              <span className="font-semibold">{stepLetter(locale, i)}.</span>
              {text(step.text)}
            </li>
          ))}
        </ul>
      </>
    );
  }
  return null;
}
