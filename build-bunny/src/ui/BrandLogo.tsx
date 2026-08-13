import Image from "next/image";

import { BunnyMascot } from "@/ui/BunnyMascot";

import { cn } from "@/ui/cn";

/**
 * NITAQ Academy identity.
 *
 * Build Bunny is a NITAQ Academy product, so the academy's mark carries the
 * institutional weight (school-facing surfaces, certificates, sign-in) while
 * the Build Bunny wordmark carries the child-facing personality. Both appear
 * together on the surfaces a school sees; the student product leads with
 * Build Bunny and credits NITAQ quietly.
 *
 * The asset is the official logo with its white background keyed out
 * (scripts/brand-assets.mjs), so it sits correctly on cream and tinted
 * surfaces instead of showing a white rectangle.
 */

const SIZES = {
  sm: { width: 132, height: 47 },
  md: { width: 180, height: 64 },
  lg: { width: 240, height: 86 },
} as const;

interface NitaqLogoProps {
  size?: keyof typeof SIZES;
  className?: string;
  /** Decorative when the brand name is already present as text nearby. */
  decorative?: boolean;
}

export function NitaqLogo({ size = "md", className, decorative = false }: NitaqLogoProps) {
  const { width, height } = SIZES[size];
  return (
    <Image
      src="/brand/nitaq-logo.png"
      alt={decorative ? "" : "NITAQ Academy"}
      aria-hidden={decorative || undefined}
      width={width}
      height={height}
      className={cn("h-auto w-auto object-contain", className)}
      priority={size === "lg"}
    />
  );
}

interface BuildBunnyWordmarkProps {
  /** "student" leads with the bunny; "pro" is the quieter school-facing lockup. */
  tone?: "student" | "pro";
  className?: string;
}

export function BuildBunnyWordmark({ tone = "student", className }: BuildBunnyWordmarkProps) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BunnyMascot size="xs" />
      <span
        className={cn(
          "font-display font-bold tracking-tight text-ink",
          tone === "student" ? "text-lg" : "text-base",
        )}
      >
        Build Bunny
      </span>
    </span>
  );
}

/**
 * The co-branded lockup: Build Bunny, credited to NITAQ. Used in headers of
 * school-facing surfaces and on the certificate, where the institution
 * matters as much as the product.
 */
export function BrandLockup({
  className,
  byLabel,
}: {
  className?: string;
  /** Localized "by NITAQ Academy" — passed in so this stays i18n-clean. */
  byLabel: string;
}) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <BuildBunnyWordmark tone="pro" />
      <span aria-hidden className="h-6 w-px bg-border-token" />
      <span className="flex items-center gap-2">
        <span className="sr-only">{byLabel}</span>
        <NitaqLogo size="sm" decorative className="max-h-7" />
      </span>
    </span>
  );
}
