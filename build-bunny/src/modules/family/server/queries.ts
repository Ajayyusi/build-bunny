import "server-only";

import { getFamilyLinkStatus } from "./links";

/**
 * Family-link tenant-scoped reads, registered for the tenant-isolation rig.
 * getFamilySummary is deliberately NOT here: it takes no session (the link
 * is the credential) and is guarded by the token hash instead, the same way
 * the public certificate check is.
 */
export { getFamilyLinkStatus };

export const tenantScopedQueries = {
  getFamilyLinkStatus,
} as const;
