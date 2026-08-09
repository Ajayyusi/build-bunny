import { Skeleton } from "@/ui";

export default function StudentLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton radius="lg" className="h-24" />
        <Skeleton radius="lg" className="h-24" />
        <Skeleton radius="lg" className="h-24" />
      </div>
      <Skeleton radius="lg" className="h-48" />
    </div>
  );
}
