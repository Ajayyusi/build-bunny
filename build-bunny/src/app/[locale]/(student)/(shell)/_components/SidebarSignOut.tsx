"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/ui";

import { localePath } from "../../../_components/locale-path";
import { LogoutIcon } from "./icons";

/**
 * Sign-out rendered as a sidebar row rather than a <Button>, so it sits
 * flush with the nav items above it. Same behavior as SignOutButton —
 * clear the session, then hard-navigate so every server component
 * re-reads it.
 */
export function SidebarSignOut() {
  const t = useTranslations("common");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await authClient.signOut();
    } finally {
      window.location.assign(localePath(locale, "/"));
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className={cn(
        "group flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-bold text-ink-muted transition-colors",
        "hover:bg-danger/10 hover:text-danger disabled:opacity-60",
      )}
    >
      <span className="grid size-5 shrink-0 place-items-center transition-transform group-hover:scale-110">
        <LogoutIcon />
      </span>
      <span className="truncate">{t("signOut")}</span>
    </button>
  );
}
