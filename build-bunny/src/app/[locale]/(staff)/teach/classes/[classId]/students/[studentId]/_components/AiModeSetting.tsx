"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import type { AiMode, AiModeChoice } from "@/modules/students/ai-mode";
import { setStudentAiModeAction } from "@/modules/students/server/ai-mode-actions";
import { Card, CardBody, CardTitle, Field, Select, runAction, useToast } from "@/ui";

/**
 * How the AI activities talk to this child: follow their grade (3-4 simpler
 * words, 5-7 terms and deeper tests), or a mode the teacher picks. Progress
 * is never touched.
 */
export function AiModeSetting({ studentUserId, choice, mode }: { studentUserId: string; choice: AiModeChoice; mode: AiMode }) {
  const t = useTranslations("staff.teach.student.aiMode");
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState<AiModeChoice>(choice);
  const [busy, setBusy] = useState(false);

  const save = async (next: AiModeChoice) => {
    setValue(next);
    setBusy(true);
    try {
      const result = await runAction(() => setStudentAiModeAction({ studentUserId, choice: next }));
      if (result.ok) {
        toast({ title: t("saved"), variant: "positive" });
        router.refresh();
      } else {
        setValue(choice);
        toast({ title: t("error"), variant: "danger" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardBody className="flex flex-col gap-2">
        <CardTitle>{t("heading")}</CardTitle>
        <p className="text-sm text-ink-muted">{t("help")}</p>
        <Field label={t("label")}>
          <Select value={value} disabled={busy} onChange={(e) => void save(e.target.value as AiModeChoice)}>
            <option value="auto">{t("auto", { mode: t(`name.${mode}`) })}</option>
            <option value="younger">{t("younger")}</option>
            <option value="older">{t("older")}</option>
          </Select>
        </Field>
      </CardBody>
    </Card>
  );
}
