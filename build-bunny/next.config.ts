import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // A package.json exists in the user home directory above this repo; without
  // an explicit root, Next infers it as the workspace root and nests the
  // standalone output under a mirrored path.
  outputFileTracingRoot: process.cwd(),
};

export default withNextIntl(nextConfig);
