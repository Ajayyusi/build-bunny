/**
 * Activity launch control (handoff: teacher "activity launch control").
 *
 * Per class, a teacher can switch each Explore AI activity off, and launch
 * one so it is pinned at the top of their students' Explore AI page as
 * "Today's AI activity". A child can be in more than one class, so the
 * rule for combining their classes' settings lives here, pure:
 *
 *  - An activity is hidden only when EVERY class the child is in has
 *    switched it off. One teacher can't take away another class's activity,
 *    and a child in no class sees everything.
 *  - The launched activity is the most recent launch across the child's
 *    classes, among activities they can still see.
 *
 * Switching an activity off only takes it off the Explore AI page: the
 * level stays open in the AI worlds, and progress is never touched.
 */

export interface ClassActivitySetting {
  classId: string;
  slug: string;
  hidden: boolean;
  launchedAt: Date | null;
}

export interface ChildExploreSettings {
  hidden: ReadonlySet<string>;
  launched: { slug: string; launchedAt: Date } | null;
}

export function settingsForChild(classIds: readonly string[], settings: readonly ClassActivitySetting[]): ChildExploreSettings {
  const hidden = new Set<string>();
  if (classIds.length > 0) {
    const slugs = new Set(settings.map((row) => row.slug));
    for (const slug of slugs) {
      const everyClassHidesIt = classIds.every((classId) =>
        settings.some((row) => row.classId === classId && row.slug === slug && row.hidden),
      );
      if (everyClassHidesIt) hidden.add(slug);
    }
  }
  let launched: ChildExploreSettings["launched"] = null;
  for (const row of settings) {
    if (!row.launchedAt || !classIds.includes(row.classId) || hidden.has(row.slug)) continue;
    if (!launched || row.launchedAt > launched.launchedAt) launched = { slug: row.slug, launchedAt: row.launchedAt };
  }
  return { hidden, launched };
}
