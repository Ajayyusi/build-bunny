import { Skeleton } from "@/ui";

/** Trail-shaped placeholder: header, then a tall banded strip of stops. */
export default function AdventureLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col gap-px overflow-hidden rounded-xl border border-border-token">
        <div className="flex flex-col items-center gap-6 bg-surface-sunken px-4 py-10">
          <Skeleton className="h-6 w-48" />
          <Skeleton radius="full" className="size-14" />
          <Skeleton radius="full" className="ms-24 size-14" />
          <Skeleton radius="full" className="size-14" />
          <Skeleton radius="full" className="me-24 size-14" />
        </div>
        <div className="flex flex-col items-center gap-6 border-t border-border-token px-4 py-10">
          <Skeleton className="h-6 w-40" />
          <Skeleton radius="full" className="size-14" />
          <Skeleton radius="full" className="ms-24 size-14" />
        </div>
      </div>
    </div>
  );
}
