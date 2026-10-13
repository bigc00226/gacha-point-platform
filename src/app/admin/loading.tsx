import { Skeleton } from "@/components/ui/misc";

/** Shown in the content area (the admin shell stays in place) while a page renders. */
export default function AdminLoading() {
  return (
    <div className="animate-fade-in space-y-6" role="status" aria-label="読み込み中">
      <div className="flex items-start gap-4">
        <Skeleton className="size-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}
