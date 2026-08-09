import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { resolveText, type LocalizedText } from "@/modules/curriculum/schemas";
import { getCurriculumLevelDetail } from "@/modules/curriculum/server/queries";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  PageHeader,
  type BadgeVariant,
  type DataTableColumn,
} from "@/ui";

import { PublishButton } from "./PublishButton";

interface Props {
  params: Promise<{ locale: string; levelId: string }>;
}

const STATUS_BADGES: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  REVIEW: "warning",
  PUBLISHED: "positive",
  ARCHIVED: "danger",
};

const ACTIVITY_KEYS = [
  "BLOCK_CODING",
  "CODE_PREDICTION",
  "DEBUGGING",
  "SEQUENCING",
] as const;

function isActivityKey(value: string): value is (typeof ACTIVITY_KEYS)[number] {
  return (ACTIVITY_KEYS as readonly string[]).includes(value);
}

const DIFFICULTY_KEYS = ["EASY", "MEDIUM", "HARD"] as const;

function isDifficultyKey(value: string): value is (typeof DIFFICULTY_KEYS)[number] {
  return (DIFFICULTY_KEYS as readonly string[]).includes(value);
}

interface TextFieldRow {
  key: string;
  label: string;
  value: LocalizedText | null;
}

interface PayloadSummary {
  variants: number | null;
  checks: { id: string; severity: string }[];
  toolbox: { type: string; limit: number | null }[];
  options: number | null;
  items: number | null;
  hasSolution: boolean;
}

/** Read-only payload highlights; the payload shape varies per activity type. */
function summarizePayload(payload: unknown): PayloadSummary {
  const record =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  return {
    variants: Array.isArray(record["variants"]) ? record["variants"].length : null,
    checks: asArray(record["checks"]).flatMap((check) => {
      if (!check || typeof check !== "object") return [];
      const c = check as Record<string, unknown>;
      return typeof c["id"] === "string"
        ? [{ id: c["id"], severity: typeof c["severity"] === "string" ? c["severity"] : "" }]
        : [];
    }),
    toolbox: asArray(record["toolbox"]).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const e = entry as Record<string, unknown>;
      return typeof e["type"] === "string"
        ? [{ type: e["type"], limit: typeof e["limit"] === "number" ? e["limit"] : null }]
        : [];
    }),
    options: Array.isArray(record["options"]) ? record["options"].length : null,
    items: Array.isArray(record["items"]) ? record["items"].length : null,
    hasSolution: record["solution"] !== undefined && record["solution"] !== null,
  };
}

export default async function CurriculumLevelPage({ params }: Props) {
  const { locale, levelId } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SUPER_ADMIN", "NITAQ_ADMIN");
  const [detail, t, tCurriculum] = await Promise.all([
    getCurriculumLevelDetail(ctx, levelId),
    getTranslations("platform.curriculum.level"),
    getTranslations("platform.curriculum"),
  ]);

  if (!detail) {
    return (
      <EmptyState
        title={t("notFoundTitle")}
        description={t("notFoundBody")}
        action={
          <Link href="/nitaq/curriculum" className="text-sm font-semibold text-brand hover:underline">
            {t("backLink")}
          </Link>
        }
      />
    );
  }

  const dateTimeFormat = new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const textRows: TextFieldRow[] = [
    { key: "title", label: t("fields.title"), value: detail.title },
    { key: "story", label: t("fields.story"), value: detail.story },
    { key: "objective", label: t("fields.objective"), value: detail.objective },
    { key: "instructions", label: t("fields.instructions"), value: detail.instructions },
    { key: "explanation", label: t("fields.explanation"), value: detail.explanation },
    { key: "teacherNotes", label: t("fields.teacherNotes"), value: detail.teacherNotes },
  ];

  const textColumns: DataTableColumn<TextFieldRow>[] = [
    {
      key: "field",
      header: t("field"),
      cell: (row) => <span className="font-semibold">{row.label}</span>,
      className: "w-36",
    },
    {
      key: "en",
      header: t("english"),
      cell: (row) =>
        row.value?.en ? (
          <span dir="ltr" className="block whitespace-pre-wrap text-start">
            {row.value.en}
          </span>
        ) : (
          <span className="text-ink-muted">{t("missing")}</span>
        ),
    },
    {
      key: "ar",
      header: t("arabic"),
      cell: (row) =>
        row.value?.ar ? (
          <span dir="rtl" className="block whitespace-pre-wrap text-start">
            {row.value.ar}
          </span>
        ) : (
          <span className="text-ink-muted">{t("missing")}</span>
        ),
    },
  ];

  type VersionRow = (typeof detail.versions)[number];
  const versionColumns: DataTableColumn<VersionRow>[] = [
    {
      key: "version",
      header: t("versionColumn"),
      cell: (row) => (
        <span className="font-mono text-xs">{t("version", { version: row.version })}</span>
      ),
    },
    {
      key: "publishedAt",
      header: t("publishedAtColumn"),
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums">
          {dateTimeFormat.format(row.publishedAt)}
        </span>
      ),
    },
  ];

  const summary = summarizePayload(detail.payload);
  const gatesOk = detail.gates.every((gate) => gate.ok);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={resolveText(detail.title, locale)}
        description={`${resolveText(detail.world.name, locale)} · ${resolveText(detail.module.name, locale)}`}
        actions={<PublishButton levelId={detail.id} />}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={STATUS_BADGES[detail.status] ?? "neutral"}>
          {tCurriculum(`status.${detail.status}`)}
        </Badge>
        <Badge variant="brand">
          {isActivityKey(detail.activityType)
            ? tCurriculum(`activity.${detail.activityType}`)
            : detail.activityType}
        </Badge>
        <Badge variant="neutral">
          {isDifficultyKey(detail.difficulty)
            ? tCurriculum(`difficulty.${detail.difficulty}`)
            : detail.difficulty}
        </Badge>
        <Badge variant="neutral">{t("meta.order", { order: detail.order })}</Badge>
        <Badge variant="neutral">{t("meta.minutes", { minutes: detail.estimatedMinutes })}</Badge>
        {detail.xpReward !== null ? (
          <Badge variant="accent">{t("meta.xp", { xp: detail.xpReward })}</Badge>
        ) : null}
        <Badge variant="neutral">{t("meta.stars", { stars: detail.maxStars })}</Badge>
        {detail.arComplete ? (
          <Badge variant="accent">{tCurriculum("arReady")}</Badge>
        ) : (
          <Badge variant="neutral">{tCurriculum("arMissing")}</Badge>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">{t("fieldsHeading")}</h2>
        <DataTable
          columns={textColumns}
          rows={textRows}
          rowKey={(row) => row.key}
          emptyMessage={t("missing")}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("payloadHeading")}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap gap-1.5">
              {summary.variants !== null ? (
                <Badge variant="neutral">
                  {t("variants", { count: summary.variants })}
                </Badge>
              ) : null}
              {summary.options !== null ? (
                <Badge variant="neutral">{t("options", { count: summary.options })}</Badge>
              ) : null}
              {summary.items !== null ? (
                <Badge variant="neutral">{t("items", { count: summary.items })}</Badge>
              ) : null}
              {summary.hasSolution ? (
                <Badge variant="positive">{t("solutionIncluded")}</Badge>
              ) : (
                <Badge variant="neutral">{t("solutionMissing")}</Badge>
              )}
            </div>
            {summary.checks.length > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-ink">{t("checks")}</span>
                <ul className="flex flex-wrap gap-1.5">
                  {summary.checks.map((check, index) => (
                    <li key={`${check.id}-${index}`}>
                      <Badge variant={check.severity === "core" ? "brand" : "neutral"}>
                        <span dir="ltr" className="font-mono text-xs">
                          {check.id}
                        </span>
                        <span>· {check.severity}</span>
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {summary.toolbox.length > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-ink">{t("toolbox")}</span>
                <ul className="flex flex-wrap gap-1.5">
                  {summary.toolbox.map((entry) => (
                    <li key={entry.type}>
                      <Badge variant="neutral">
                        <span dir="ltr" className="font-mono text-xs">
                          {entry.type}
                        </span>
                        {entry.limit !== null ? (
                          <span className="tabular-nums">×{entry.limit}</span>
                        ) : null}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>{t("gatesHeading")}</CardTitle>
            <Badge variant={gatesOk ? "positive" : "danger"}>
              {gatesOk ? t("gatesReady") : t("gatesBlocked")}
            </Badge>
          </CardHeader>
          <CardBody>
            <ul className="flex flex-col gap-2">
              {detail.gates.map((gate) => (
                <li key={gate.gate} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        gate.skipped ? "neutral" : gate.ok ? "positive" : "danger"
                      }
                    >
                      {gate.skipped
                        ? t("gateSkipped")
                        : gate.ok
                          ? t("gatePassed")
                          : t("gateFailed")}
                    </Badge>
                    <span dir="ltr" className="font-mono text-xs text-ink">
                      {gate.gate}
                    </span>
                    {gate.reason ? (
                      <span className="text-xs text-ink-muted">{gate.reason}</span>
                    ) : null}
                  </div>
                  {gate.issues.length > 0 ? (
                    <ul className="ps-2 text-xs text-danger">
                      {gate.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">{t("hintsHeading")}</h2>
        {detail.hints.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("missing")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {detail.hints.map((hint) => (
              <Card key={hint.tier}>
                <CardBody className="flex flex-col gap-1.5 text-sm">
                  <Badge variant="brand" className="self-start">
                    {t("hintTier", { tier: hint.tier })}
                  </Badge>
                  <p dir="ltr" className="text-start">
                    {hint.text.en}
                  </p>
                  {hint.text.ar ? (
                    <p dir="rtl" className="text-start text-ink-muted">
                      {hint.text.ar}
                    </p>
                  ) : null}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">{t("versionsHeading")}</h2>
        <DataTable
          columns={versionColumns}
          rows={detail.versions}
          rowKey={(row) => String(row.version)}
          emptyMessage={t("versionsEmpty")}
        />
      </section>

      <div>
        <Link
          href="/nitaq/curriculum"
          className="text-sm font-semibold text-brand hover:underline"
        >
          {t("backLink")}
        </Link>
      </div>
    </div>
  );
}
