import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { isFeatureEnabled } from "@/modules/shared/features";
import {
  getMyStudentSnapshot,
  getMyUnreadFeedbackCount,
} from "@/modules/students/server/queries";
import { Avatar, BunnyMascot, SkipLink, SoundToggle } from "@/ui";

import {
  HomeIcon,
  PathIcon,
  ProfileIcon,
  TrophyIcon,
} from "./_components/icons";
import { SidebarNavItem } from "./_components/SidebarNav";
import { LocaleSwitcher } from "../../_components/LocaleSwitcher";
import { SidebarShell } from "./_components/SidebarShell";
import { SidebarSignOut } from "./_components/SidebarSignOut";

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Student chrome for the browsing surfaces: home, adventure, achievements,
 * profile. The play route lives in the (immersive) sibling group and
 * renders without any of this.
 *
 * Layout is a persistent left sidebar (drawer below lg — see SidebarShell)
 * with the progress chips moved into a top-right cluster on the pages
 * themselves. requireRole is request-cached, so re-deriving ctx costs
 * nothing.
 */
export default async function StudentShellLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("STUDENT");
  const [snapshot, unreadFeedback, t, tCommon] = await Promise.all([
    getMyStudentSnapshot(ctx),
    getMyUnreadFeedbackCount(ctx),
    getTranslations("student"),
    getTranslations("common"),
  ]);
  const displayName = snapshot?.user.displayName ?? ctx.displayName;
  // No dead nav: the Adventure item exists only when the school's flag is on
  // (m2 §flags) — the /adventure page enforces the same check server-side.
  const adventureEnabled = isFeatureEnabled(
    snapshot?.school.features,
    "adventure",
  );

  const sidebar = (
    <>
      {/* Brand + identity block */}
      <div className="flex flex-col gap-4">
        <Link
          href="/home"
          className="flex min-h-11 items-center gap-2 font-display text-lg font-bold text-ink"
        >
          <BunnyMascot size="xs" />
          {tCommon("appName")}
        </Link>
        <div className="flex items-center gap-3 rounded-xl bg-surface-sunken p-3">
          <Avatar displayName={displayName} size="md" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-display text-sm font-bold text-ink">
              {displayName}
            </span>
            {snapshot?.school.name ? (
              <span className="truncate text-xs text-ink-muted">
                {snapshot.school.name}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <nav aria-label={t("nav.label")} className="flex flex-col gap-1">
        {/* The inbox lives on Home, so the unread count belongs on the row
            that leads there — a message a child never notices is one their
            teacher may as well not have written. */}
        <SidebarNavItem
          href="/home"
          icon={<HomeIcon />}
          badge={unreadFeedback}
          badgeLabel={t("nav.unreadFeedback", { count: unreadFeedback })}
        >
          {t("nav.home")}
        </SidebarNavItem>
        {adventureEnabled ? (
          <SidebarNavItem href="/adventure" icon={<PathIcon />}>
            {t("nav.adventure")}
          </SidebarNavItem>
        ) : null}
        <SidebarNavItem href="/achievements" icon={<TrophyIcon />}>
          {t("nav.achievements")}
        </SidebarNavItem>
      </nav>

      {/* Account block pinned to the bottom of the rail. The language
          switcher sits directly on the rail, not only inside Profile: a child
          stranded in the wrong language cannot read their way to a settings
          page, so the one control that fixes it must never be behind text. */}
      <div className="mt-auto flex flex-col gap-1 border-t border-border-token pt-3">
        <LocaleSwitcher size="lg" className="w-full justify-start" />
        <SoundToggle
          labelOn={t("sound.on")}
          labelOff={t("sound.off")}
          className="w-full justify-start"
        />
        <SidebarNavItem href="/profile" icon={<ProfileIcon />}>
          {t("nav.profile")}
        </SidebarNavItem>
        <SidebarSignOut />
      </div>
    </>
  );

  return (
    <>
      <SkipLink label={tCommon("skipToContent")} />
      <SidebarShell sidebar={sidebar} menuLabel={t("nav.menu")}>
        {children}
      </SidebarShell>
    </>
  );
}
