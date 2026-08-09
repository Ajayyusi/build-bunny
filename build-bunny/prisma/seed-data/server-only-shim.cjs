// Inert stand-in for the "server-only" marker import. Next.js aliases that
// specifier at build time (the package is not installed); under tsx/node the
// seed maps it here so src server modules load outside the Next runtime.
module.exports = {};
