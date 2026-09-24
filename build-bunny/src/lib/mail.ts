import "server-only";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Outgoing email, through Resend's HTTP API (no SDK: one POST is all we
 * need). Used only by the weekly family email. Nothing here is configured by
 * default — `isMailConfigured()` is false until RESEND_API_KEY and
 * FAMILY_EMAIL_FROM are set, and every caller checks it first.
 *
 * Tests swap the transport with `setMailTransportForTests`, so no test can
 * reach the real service.
 */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  /** Resend drops a repeat with the same key for 24 hours: a retried run never double-sends. */
  idempotencyKey?: string;
}

export type MailResult = { ok: true; id: string | null } | { ok: false; error: string };

type Transport = (message: MailMessage) => Promise<MailResult>;

export function isMailConfigured(): boolean {
  // A test transport counts as configured.
  return transport !== resendTransport || Boolean(env.RESEND_API_KEY && env.FAMILY_EMAIL_FROM);
}

const resendTransport: Transport = async (message) => {
  if (!env.RESEND_API_KEY || !env.FAMILY_EMAIL_FROM) return { ok: false, error: "not-configured" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: env.FAMILY_EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      // Resend's error body names the problem (bad domain, rate limit); it
      // never echoes the key. The recipient is left out of the log.
      const body = await response.text().catch(() => "");
      return { ok: false, error: `resend ${response.status}: ${body.slice(0, 200)}` };
    }
    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id ?? null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "network error" };
  }
};

let transport: Transport = resendTransport;

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const result = await transport(message);
  if (!result.ok) logger.warn("mail.send_failed", { error: result.error });
  return result;
}

/** Test seam: returns a restore function. */
export function setMailTransportForTests(fake: Transport): () => void {
  const previous = transport;
  transport = fake;
  return () => {
    transport = previous;
  };
}
