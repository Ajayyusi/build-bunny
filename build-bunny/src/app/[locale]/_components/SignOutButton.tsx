"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { authClient } from "@/lib/auth-client";
import { Button, type ButtonSize, type ButtonVariant } from "@/ui";

import { localePath } from "./locale-path";

interface SignOutButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function SignOutButton({
  variant = "ghost",
  size = "md",
}: SignOutButtonProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await authClient.signOut();
    } finally {
      // Hard navigation so every server component re-reads the cleared session.
      window.location.assign(localePath(locale, "/"));
    }
  }

  return (
    <Button variant={variant} size={size} loading={loading} onClick={handleSignOut}>
      {t("signOut")}
    </Button>
  );
}
