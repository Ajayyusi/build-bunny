import { Skeleton } from "@/ui";

/** Player-shaped placeholder: top bar, sim panel, workspace, action bar. */
export default function PlayLevelLoading() {
  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border-token bg-surface-raised px-4">
        <Skeleton radius="md" className="size-9" />
        <Skeleton className="h-5 w-44" />
        <div className="ms-auto">
          <Skeleton radius="lg" className="h-9 w-36" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex h-[42dvh] shrink-0 flex-col gap-3 border-b border-border-token p-3 lg:h-auto lg:w-[42%] lg:border-b-0 lg:border-e">
          <Skeleton radius="lg" className="min-h-0 flex-1" />
          <div className="hidden gap-2 lg:flex">
            <Skeleton radius="lg" className="h-11 w-32" />
            <Skeleton radius="lg" className="h-11 w-24" />
            <Skeleton radius="lg" className="h-11 w-24" />
          </div>
        </div>
        <div className="min-h-0 flex-1 p-3">
          <Skeleton radius="lg" className="h-full" />
        </div>
      </div>
      <div className="flex shrink-0 gap-2 border-t border-border-token bg-surface-raised p-2 lg:hidden">
        <Skeleton radius="lg" className="h-11 flex-1" />
        <Skeleton radius="lg" className="h-11 w-24" />
        <Skeleton radius="lg" className="h-11 w-24" />
      </div>
    </div>
  );
}
