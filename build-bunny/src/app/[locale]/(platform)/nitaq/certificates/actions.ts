"use server";

import { z } from "zod";

import { withAuth, type ActionResult } from "@/modules/auth/server/guard";
import {
  revokeCertificate,
  type RevokedCertificate,
} from "@/modules/certificates/server/revoke";

const revokeInput = z.object({
  certificateId: z.string().min(1),
  // A revocation with no recorded reason is not something a school can be
  // answered with later, so the reason is required, not optional.
  reason: z.string().trim().min(3).max(500),
});

export async function revokeCertificateAction(
  input: unknown,
): Promise<ActionResult<RevokedCertificate>> {
  return withAuth("certificates:revoke", revokeInput, (ctx, data) =>
    revokeCertificate(ctx, data),
  )(input);
}
