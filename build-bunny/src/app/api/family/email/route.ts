import { NextResponse, type NextRequest } from "next/server";

import { createRateLimiter } from "@/lib/rate-limit";
import { confirmFamilyEmail, stopFamilyEmail } from "@/modules/family/server/email";

/**
 * The family's two buttons, and the one-click unsubscribe mail apps send.
 * No session: the signed token is the credential.
 *
 *  - The confirm page posts a form (token, intent, locale) and is sent back
 *    to itself with a 303, so it works without JavaScript.
 *  - Mail apps POST `List-Unsubscribe=One-Click` to the List-Unsubscribe URL
 *    (RFC 8058), with the token and intent=stop in the query. They get 200.
 *
 * Only POST changes anything: link scanners that open every URL in an email
 * with GET must never confirm or stop on a family's behalf.
 */
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

export async function POST(request: NextRequest) {
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (clientKey && !limiter.allow(clientKey)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const query = request.nextUrl.searchParams;
  let form: FormData | null = null;
  try {
    form = await request.formData();
  } catch {
    form = null;
  }
  const field = (name: string) => {
    const value = form?.get(name) ?? query.get(name);
    return typeof value === "string" ? value : "";
  };
  const token = field("token");
  const intent = field("intent");
  const locale = field("locale") === "ar" ? "ar" : field("locale") === "en" ? "en" : null;

  let ok = false;
  if (intent === "confirm") ok = await confirmFamilyEmail(token);
  else if (intent === "stop") ok = await stopFamilyEmail(token);

  // From the page: back to it, which now shows the new state.
  if (locale && /^[A-Za-z0-9._-]{1,120}$/.test(token)) {
    return NextResponse.redirect(new URL(`/${locale}/family/email/${token}`, request.nextUrl.origin), 303);
  }
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
