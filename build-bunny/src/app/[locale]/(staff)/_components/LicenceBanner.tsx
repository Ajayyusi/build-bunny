import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { LicenceNotice } from "@/modules/schools/server/queries";

/**
 * Tells a school admin their licence is about to stop working, before it does.
 *
 * This is the counterpart to enforcement. Licence state now genuinely decides
 * access, so a lapse takes the product away from a whole school of children —
 * and the only licence information a school admin could previously see was a
 * seat count with no expiry date anywhere. Enforcing a date nobody was shown
 * is not enforcement, it is an outage with extra steps.
 *
 * Shown to SCHOOL_ADMIN only: a teacher can do nothing about a licence, and
 * an alarming banner they cannot act on is just noise on their dashboard.
 *
 * Severity is deliberately graded. "Expiring soon" is a warning; being in the
 * grace period, read-only, or out of seats is already a live problem. A
 * banner that always shouts gets ignored exactly when it matters.
 */

const URGENT: LicenceNotice["kind"][] = ["GRACE", "READ_ONLY", "NO_LICENCE", "SEATS_FULL"];

export async function LicenceBanner({ notice }: { notice: LicenceNotice }) {
  const t = await getTranslations("staff.licenceBanner");
  const urgent = URGENT.includes(notice.kind);

  const message = (() => {
    switch (notice.kind) {
      case "EXPIRING_SOON":
        return t("expiringSoon", { days: notice.daysRemaining ?? 0 });
      case "GRACE":
        return t("grace", { days: notice.daysRemaining ?? 0 });
      case "READ_ONLY":
        return t("readOnly");
      case "NO_LICENCE":
        return t("noLicence");
      case "SEATS_FULL":
        return t("seatsFull", { total: notice.seatsTotal ?? 0 });
      case "SEATS_NEARLY_FULL":
        return t("seatsNearlyFull", { used: notice.seatsUsed, total: notice.seatsTotal ?? 0 });
    }
  })();

  return (
    <div
      // Not role="alert": this renders on every page load, and an assertive
      // live region would interrupt a screen-reader user on every navigation.
      // It is a standing state, so it is a region they can reach on purpose.
      role="region"
      aria-label={t("label")}
      className={
        urgent
          ? "border-b border-danger/40 bg-danger/10 print:hidden"
          : "border-b border-warning/40 bg-warning/10 print:hidden"
      }
    >
      <div className="bb-container flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
        <p className="text-sm font-medium text-ink">{message}</p>
        <Link
          href="/school"
          className="inline-flex h-11 items-center text-sm font-bold text-brand hover:underline"
        >
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
