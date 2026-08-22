"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button, runAction } from "@/ui";

import { markFeedbackReadAction } from "./feedback-actions";

export interface FeedbackItemVM {
  id: string;
  body: string;
  teacherName: string;
  levelId: string;
  levelTitle: string;
  dateLabel: string;
  read: boolean;
}

/**
 * Messages from a teacher, on the student's home screen.
 *
 * Teachers have been able to write these all along; nothing ever showed them
 * to the child, so every one was written into a void and stayed "unread" on
 * the teacher's screen forever.
 *
 * Read state is set when the child OPENS a message, not when the list
 * renders — otherwise "read" would only mean the page loaded, which tells a
 * teacher nothing about whether their words were seen. It is one-way
 * guidance with no reply box, because replies are not supported and implying
 * them would leave a child waiting for an answer that cannot come.
 */
export function FeedbackInbox({ items }: { items: FeedbackItemVM[] }) {
  const t = useTranslations("student.home.feedback");
  const [openId, setOpenId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  if (items.length === 0) return null;

  const isRead = (item: FeedbackItemVM) => item.read || readIds.includes(item.id);

  const toggle = (item: FeedbackItemVM) => {
    const next = openId === item.id ? null : item.id;
    setOpenId(next);
    if (next && !isRead(item)) {
      // Optimistic: the badge should disappear the instant they open it.
      // If the write fails the message simply stays unread, which is the
      // safe direction to be wrong in.
      setReadIds((current) => [...current, item.id]);
      startTransition(async () => {
        await runAction(() => markFeedbackReadAction({ feedbackId: item.id }));
      });
    }
  };

  const unread = items.filter((item) => !isRead(item)).length;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        {t("heading")}
        {unread > 0 ? (
          <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-on-brand">
            {unread}
          </span>
        ) : null}
      </h2>

      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const open = openId === item.id;
          return (
            <li
              key={item.id}
              className="rounded-xl border border-border-token bg-surface-raised"
            >
              <button
                type="button"
                onClick={() => toggle(item)}
                aria-expanded={open}
                className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-start"
              >
                {!isRead(item) ? (
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full bg-brand"
                  />
                ) : (
                  <span aria-hidden="true" className="size-2.5 shrink-0" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-ink">
                    {t("from", { teacher: item.teacherName })}
                  </span>
                  <span className="truncate text-xs text-ink-muted">
                    {item.levelTitle} · {item.dateLabel}
                  </span>
                </span>
                {/* Screen readers get the state in words, not just a dot. */}
                <span className="sr-only">{isRead(item) ? t("read") : t("unread")}</span>
              </button>

              {open ? (
                <div className="flex flex-col gap-3 border-t border-border-token px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {item.body}
                  </p>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="self-start"
                    onClick={() => {
                      window.location.assign(`/play/${item.levelId}`);
                    }}
                  >
                    {t("openLevel")}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
