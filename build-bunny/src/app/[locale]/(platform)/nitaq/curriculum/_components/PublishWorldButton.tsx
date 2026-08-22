"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button, useToast, runAction } from "@/ui";

import { publishWorldAction } from "../actions";

interface Props {
  worldId: string;
  worldName: string;
  /** Levels in this world not yet live — the button hides when there are none. */
  pendingCount: number;
}

/**
 * Bring a whole world live in one press.
 *
 * Publishing was per-level only, so a freshly imported world meant one click
 * per level with no way to see part-way through whether you had missed one —
 * which is exactly how a production site ends up serving a partial
 * curriculum. publishWorld is all-or-nothing on the gates: either every
 * pending level passes and the world goes live intact, or nothing changes
 * and the failures come back named.
 */
export function PublishWorldButton({ worldId, worldName, pendingCount }: Props) {
  const t = useTranslations("platform.curriculum.publishWorld");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [failures, setFailures] = useState<string[]>([]);

  if (pendingCount === 0) return null;

  const publish = () => {
    setFailures([]);
    startTransition(async () => {
      const result = await runAction(() => publishWorldAction({ worldId }));
      if (!result.ok) {
        toast({ title: t("failed"), variant: "danger" });
        return;
      }
      if (result.data.ok) {
        toast({
          title: t("done", { count: result.data.levels.length, world: worldName }),
          variant: "positive",
        });
        router.refresh();
        return;
      }
      // Gates failed: name the levels rather than a generic error, because
      // the fix is always in a specific level's content.
      setFailures(result.data.levels.filter((level) => !level.ok).map((level) => level.slug));
      toast({ title: t("gatesFailed"), variant: "danger" });
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" size="sm" onClick={publish} loading={pending}>
        {t("action", { count: pendingCount })}
      </Button>
      {failures.length > 0 ? (
        <p className="text-xs text-danger">
          {t("gatesFailedDetail", { levels: failures.join(", ") })}
        </p>
      ) : null}
    </div>
  );
}
