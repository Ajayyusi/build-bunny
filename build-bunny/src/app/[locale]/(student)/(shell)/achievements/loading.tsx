import { Skeleton } from "@/ui";

/** Badge-grid-shaped placeholder (UX doc §7: "grid skeleton"). */
export default function AchievementsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} radius="lg" className="h-28" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton radius="lg" className="h-24" />
          <Skeleton radius="lg" className="h-24" />
        </div>
      </div>
    </div>
  );
}
