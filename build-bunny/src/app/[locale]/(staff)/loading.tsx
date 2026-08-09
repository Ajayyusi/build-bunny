import { Skeleton } from "@/ui";

export default function StaffLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton radius="lg" className="h-24" />
        <Skeleton radius="lg" className="h-24" />
        <Skeleton radius="lg" className="h-24" />
      </div>
      <Skeleton radius="lg" className="h-64" />
    </div>
  );
}
