"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { authClient } from "@/lib/auth-client";
import { homePathForRole, isRole } from "@/modules/auth/roles";
import { Button, Field, Input } from "@/ui";

import { localePath } from "../../_components/locale-path";

export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (signInError) {
        if (signInError.code === "BANNED_USER") {
          setError(t("errors.disabled"));
        } else if (signInError.status >= 500) {
          setError(t("errors.generic"));
        } else {
          setError(t("errors.invalidCredentials"));
        }
        setLoading(false);
        return;
      }

      // The session is authoritative for role/mustChangePassword — hard
      // navigation so every server component re-reads it.
      const session = await authClient.getSession();
      const user = session.data?.user;
      if (user?.mustChangePassword) {
        window.location.assign(localePath(locale, "/change-password"));
        return;
      }
      const roleValue = user?.role;
      const role = isRole(roleValue) ? roleValue : null;
      window.location.assign(
        localePath(locale, role ? homePathForRole(role) : "/"),
      );
    } catch {
      setError(t("errors.generic"));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {error ? (
        <p
          role="alert"
          className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
        >
          {error}
        </p>
      ) : null}
      <Field label={t("staff.email")}>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Field label={t("staff.password")}>
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      <Button type="submit" loading={loading} className="w-full">
        {t("staff.submit")}
      </Button>
    </form>
  );
}
