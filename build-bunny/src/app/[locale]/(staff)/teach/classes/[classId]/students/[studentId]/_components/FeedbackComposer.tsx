"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { giveFeedback } from "@/modules/analytics/server/actions";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Field,
  Select,
  formatDisplayDate,
  useToast,
} from "@/ui";

export interface FeedbackEntryVM {
  id: string;
  body: string;
  teacherDisplayName: string;
  levelTitle: string;
  createdAt: string;
  readAt: string | null;
}

export interface FeedbackComposerProps {
  studentUserId: string;
  levelOptions: { id: string; label: string }[];
  entries: FeedbackEntryVM[];
}

/**
 * Feedback thread + composer (m4 deliverable 4): posts via the giveFeedback
 * server action, then refreshes the server component tree so the new note
 * (and every other server-rendered fact on the page) stays in sync.
 */
export function FeedbackComposer({ studentUserId, levelOptions, entries }: FeedbackComposerProps) {
  const t = useTranslations("staff.teach.student.feedback");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [levelId, setLevelId] = useState(levelOptions[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!levelId || body.trim() === "") return;
    setBusy(true);
    setError(null);
    try {
      const result = await giveFeedback({ studentUserId, levelId, body: body.trim() });
      if (!result.ok) {
        setError(t("error"));
        return;
      }
      setBody("");
      toast({ title: t("sent"), variant: "positive" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {levelOptions.length > 0 ? (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <Field label={t("levelLabel")}>
              <Select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                {levelOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("bodyLabel")}>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("bodyPlaceholder")}
                rows={3}
                className="w-full min-w-0 rounded-md border border-ink/20 bg-surface-raised p-3 text-sm text-ink transition-colors placeholder:text-ink-faint focus-visible:border-brand"
              />
            </Field>
            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button loading={busy} disabled={body.trim() === ""} onClick={handleSend}>
                {t("send")}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {entries.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-border-token bg-surface-raised p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{entry.teacherDisplayName}</span>
                <div className="flex items-center gap-2">
                  {entry.readAt === null ? <Badge variant="brand">{t("unread")}</Badge> : null}
                  <span className="text-xs text-ink-muted" dir="ltr">
                    {formatDisplayDate(new Date(entry.createdAt), locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs font-medium text-ink-muted">{entry.levelTitle}</p>
              <p className="mt-2 text-sm text-ink">{entry.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
