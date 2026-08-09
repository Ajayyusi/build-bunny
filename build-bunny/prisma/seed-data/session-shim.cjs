// Stand-in for @/modules/auth/server/session when src server modules run under
// tsx. The real module is request-scoped (next/headers, react cache, the Better
// Auth instance) and cannot exist in a seed process. Provisioning only reaches
// it through guard.ts for ConflictError/AuthError class identity — no code path
// the seed exercises ever calls these guards.
class AuthError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.name = "AuthError";
  }
}

const unavailable = (name) => async () => {
  throw new Error(`${name}() is not available outside the Next.js runtime (seed process)`);
};

module.exports = {
  AuthError,
  getSessionContext: async () => null,
  requireRole: unavailable("requireRole"),
  requirePermission: unavailable("requirePermission"),
};
