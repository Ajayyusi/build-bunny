import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getFamilyEmailPage } from "@/modules/family/server/email";
import { BunnyMascot, Button, Card, CardBody } from "@/ui";

import { LocaleSwitcher } from "../../../../_components/LocaleSwitcher";

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

// The token is in the path: never send it on as a referrer, never index it.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/**
 * Where the family's email links land: confirm the weekly email, say no, or
 * stop it later. Opening the page changes nothing (mail scanners open every
 * link); only the buttons do, as plain form posts that work without script.
 * Before the family confirms, the page names the school but not the child.
 */
export default async function FamilyEmailPage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const [t, tCommon, view] = await Promise.all([
    getTranslations("familyEmail.page"),
    getTranslations("common"),
    getFamilyEmailPage(token),
  ]);

  const form = (intent: "confirm" | "stop", label: string, variant: "primary" | "secondary") => (
    <form method="post" action="/api/family/email">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" variant={variant}>
        {label}
      </Button>
    </form>
  );

  let icon = "🔒";
  let title = t("inactiveTitle");
  let body = t("inactiveBody");
  let actions: React.ReactNode = null;
  if (view?.state === "pending") {
    icon = "✉️";
    title = t("pendingTitle");
    body = t("pendingBody", { school: view.schoolName });
    actions = (
      <>
        {form("confirm", t("confirm"), "primary")}
        {form("stop", t("decline"), "secondary")}
      </>
    );
  } else if (view?.state === "active") {
    icon = "✅";
    title = t("activeTitle");
    body = t("activeBody", { name: view.displayName ?? "" });
    actions = form("stop", t("stop"), "secondary");
  } else if (view?.state === "stopped") {
    icon = "👋";
    title = t("stoppedTitle");
    body = t("stoppedBody");
  }

  return (
    <div data-theme="play" className="flex min-h-dvh flex-col bg-surface text-ink">
      <header className="bb-container flex h-16 items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 font-display text-lg font-bold">
          <BunnyMascot size="xs" />
          {tCommon("appName")}
        </Link>
        <LocaleSwitcher />
      </header>
      <main className="bb-container flex flex-1 flex-col py-8">
        <Card className="mx-auto w-full max-w-md">
          <CardBody className="flex flex-col items-center gap-3 py-8 text-center">
            <span aria-hidden className="text-3xl">
              {icon}
            </span>
            <h1 className="font-display text-xl font-bold">{title}</h1>
            <p className="text-sm text-ink-muted">{body}</p>
            {actions ? <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div> : null}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
