import { getTranslations } from "next-intl/server";

import { themeEmoji } from "./theme";
import type { HorizonWorldVM } from "./types";

interface HorizonBandProps {
  worlds: HorizonWorldVM[];
}

/**
 * Trail terminus: future worlds as a soft, explicitly non-interactive
 * panorama (plan §0.1-4) — art placeholder + name + tagline, no buttons and
 * no coming-soon page behind it. Server-rendered; nothing here is clickable.
 */
export async function HorizonBand({ worlds }: HorizonBandProps) {
  if (worlds.length === 0) return null;
  const t = await getTranslations("student.adventure");

  return (
    <section
      aria-label={t("horizonHeading")}
      className="border-t border-border-token bg-surface-sunken px-4 py-10 sm:px-8"
    >
      <div className="mx-auto flex max-w-xl flex-col items-center gap-1 text-center">
        <h2 className="font-display text-lg font-semibold text-ink-muted">
          {t("horizonHeading")}
        </h2>
        <p className="text-sm text-ink-muted">{t("horizonBody")}</p>
      </div>
      <ul className="mx-auto mt-6 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
        {worlds.map((world) => (
          <li
            key={world.id}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border-token bg-surface px-3 py-5 text-center"
          >
            <span aria-hidden="true" className="text-2xl">
              {themeEmoji(world.theme)}
            </span>
            <span className="text-sm font-bold text-ink-muted">
              {world.name}
            </span>
            {world.tagline ? (
              <span className="text-xs text-ink-muted">{world.tagline}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
