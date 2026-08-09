"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { authClient } from "@/lib/auth-client";
import { markPasswordChanged } from "@/modules/auth/server/actions";
import { Button, Field, Input } from "@/ui";

import { localePath } from "../../_components/locale-path";

interface ChangePasswordFormProps {
  /** Role home computed server-side (client never derives authorization). */
  homePath: string;
  inputSize: "md" | "lg";
}

export function ChangePasswordForm({
  homePath,
  inputSize,
}: ChangePasswordFormProps) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [newError, setNewError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    // minPasswordLength mirrors the server's Better Auth config (6).
    const tooShort =
      newPassword.length < 6 ? t("errors.passwordTooShort") : null;
    const mismatch =
      newPassword !== confirmPassword ? t("errors.passwordMismatch") : null;
    setNewError(tooShort);
    setConfirmError(mismatch);
    if (tooShort || mismatch) return;

    setLoading(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        if (error.code === "INVALID_PASSWORD") {
          setFormError(t("errors.wrongCurrentPassword"));
        } else if (error.code === "PASSWORD_TOO_SHORT") {
          setFormError(t("errors.passwordTooShort"));
        } else {
          setFormError(t("errors.generic"));
        }
        setLoading(false);
        return;
      }

      const result = await markPasswordChanged();
      if (!result.ok) {
        setFormError(t("errors.generic"));
        setLoading(false);
        return;
      }
      window.location.assign(localePath(locale, homePath));
    } catch {
      setFormError(t("errors.generic"));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {formError ? (
        <p
          role="alert"
          className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
        >
          {formError}
        </p>
      ) : null}
      <Field label={t("changePassword.current")}>
        <Input
          size={inputSize}
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </Field>
      <Field
        label={t("changePassword.new")}
        hint={t("changePassword.newHint")}
        error={newError}
      >
        <Input
          size={inputSize}
          type="password"
          name="newPassword"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </Field>
      <Field label={t("changePassword.confirm")} error={confirmError}>
        <Input
          size={inputSize}
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </Field>
      <Button
        type="submit"
        size={inputSize === "lg" ? "lg" : "md"}
        loading={loading}
        className="w-full"
      >
        {t("changePassword.submit")}
      </Button>
    </form>
  );
}
