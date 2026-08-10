import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

/**
 * Security headers (m5 task 4 / plan §34-§35 / security-rbac.md §8). Applied
 * as static headers() rather than per-request middleware: this app has no
 * external script/style/image/font/connect dependency (fonts are self-hosted
 * via next/font, Avatar is CSS-only initials — no gravatar, Blockly's audio/
 * cursor/icon media ships from /public/blockly-media, and grep confirms zero
 * `https://` literals in src/), so a single locked-down same-origin policy
 * covers every route without per-request state.
 *
 * `'unsafe-inline'` on script-src and style-src is a deliberate, verified
 * trade-off, not an oversight:
 *  - script-src: App Router hydrates by streaming the RSC payload through
 *    inline `<script>self.__next_f.push(...)</script>` tags on every
 *    response — unavoidable without a per-request nonce. A nonce requires
 *    middleware (src/middleware.ts is next-intl's routing middleware); Next
 *    concatenates a middleware-set CSP with this next.config.ts one into a
 *    single invalid comma-joined header instead of merging them, so mixing
 *    the two sources is worse than picking one. next.config.ts is the
 *    location this task specifies, so this file is the single source.
 *  - style-src: ProgressMatrix.tsx and SuccessOverlay.tsx use React's
 *    `style={{...}}` for computed values, and Blockly injects its own
 *    runtime `Blockly.Css.inject()` <style> tag — neither can carry a nonce.
 * Everything else (img/font/media/connect/object/base-uri/form-action/
 * frame-ancestors) stays same-origin-only or blocked outright, so this still
 * stops the attacks that matter most for a school product: no attacker
 * script/stylesheet can load from a third-party host, the app can never be
 * framed by another site (clickjacking), and forms can't be redirected off-
 * origin. Verified by `npm run build` + static grep of the standalone output
 * for stray external hosts (see docs/accessibility.md's sibling security
 * notes in the M5 report — no violations found).
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

// Every powerful browser feature denied by default; clipboard-write stays
// same-origin-enabled because the school-admin/teacher "copy password" and
// "copy join code" buttons (StudentsManager, TeachersManager, SchoolsManager)
// call navigator.clipboard.writeText and would silently fail otherwise.
const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "fullscreen=()",
  "display-capture=()",
  "interest-cohort=()",
  "clipboard-write=(self)",
].join(", ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // A package.json exists in the user home directory above this repo; without
  // an explicit root, Next infers it as the workspace root and nests the
  // standalone output under a mirrored path.
  outputFileTracingRoot: process.cwd(),

  // The teacher-side grader (`src/modules/blockly/server/codegen.ts`) imports
  // `blockly` on the server, which transitively pulls in `jsdom`. jsdom's
  // deps (`html-encoding-sniffer` CJS → `@exodus/bytes` ESM) trip Node's
  // CJS/ESM interop when webpack rewrites them for the serverless bundle,
  // producing `require() of ES Module ... not supported` at request time on
  // Vercel. Marking these packages as external keeps them as plain
  // node_modules requires that Node resolves natively — no webpack rewrite,
  // no interop crash. Only affects the Node/Server runtime; client bundles
  // never load jsdom.
  serverExternalPackages: ["blockly", "jsdom"],

  async headers() {
    return [
      {
        // Every route, including /api/* — X-Content-Type-Options in
        // particular matters most on JSON API responses (blocks MIME
        // sniffing an attacker-controlled field into executable content).
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
          // Legacy fallback for browsers predating CSP3's frame-ancestors.
          { key: "X-Frame-Options", value: "DENY" },
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
