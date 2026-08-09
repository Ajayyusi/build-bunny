"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { authClient } from "@/lib/auth-client";
import { Badge, Button, Field, Input } from "@/ui";

import { localePath } from "../../_components/locale-path";

/**
 * Two-step big-target flow for Grades 3–7: school code first (from the login
 * card), then username + password. The stored username is namespaced
 * `{schoolCode}__{username}`, both lowercased — the child never sees that.
 */
export function StudentLoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [step, setStep] = useState<"code" | "account">("code");
  const [schoolCode, setSchoolCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (schoolCode.trim() === "") {
      setError(t("errors.schoolCodeRequired"));
      return;
    }
    setError(null);
    setStep("account");
  }

  function handleBack() {
    setError(null);
    setStep("code");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const namespaced = `${schoolCode.trim().toLowerCase()}__${username.trim().toLowerCase()}`;
      const { error: signInError } = await authClient.signIn.username({
        username: namespaced,
        password,
      });
      if (signInError) {
        if (signInError.code === "BANNED_USER") {
          setError(t("errors.studentDisabled"));
        } else if (signInError.status >= 500) {
          setError(t("errors.generic"));
        } else {
          setError(t("errors.studentInvalid"));
        }
        setLoading(false);
        return;
      }
      window.location.assign(localePath(locale, "/home"));
    } catch {
      setError(t("errors.generic"));
      setLoading(false);
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={handleContinue} noValidate className="flex flex-col gap-4">
        <p className="text-base text-ink-muted">{t("student.codeSubtitle")}</p>
        {error ? (
          <p
            role="alert"
            className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
          >
            {error}
          </p>
        ) : null}
        <Field label={t("student.schoolCode")} hint={t("student.schoolCodeHint")}>
          <Input
            size="lg"
            name="schoolCode"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            value={schoolCode}
            onChange={(event) => setSchoolCode(event.target.value)}
            className="text-center font-semibold uppercase tracking-widest"
          />
        </Field>
        <Button type="submit" size="lg" className="w-full">
          {t("student.continue")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-base text-ink-muted">{t("student.accountSubtitle")}</p>
      <div className="flex items-center justify-between gap-3 rounded-md bg-surface-sunken px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink-muted">
          {t("student.schoolCode")}
          <Badge variant="brand" className="uppercase tracking-widest">
            {schoolCode.trim()}
          </Badge>
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={handleBack}>
          {t("student.changeCode")}
        </Button>
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
        >
          {error}
        </p>
      ) : null}
      <Field label={t("student.username")}>
        <Input
          size="lg"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </Field>
      <Field label={t("student.password")}>
        <Input
          size="lg"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      <Button type="submit" size="lg" loading={loading} className="w-full">
        {t("student.submit")}
      </Button>
    </form>
  );
}
