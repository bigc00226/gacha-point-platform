import { Skeleton } from "@/components/ui/misc";

/** Instant feedback while a member page renders on the server (pages here are dynamic). */
export default function SiteLoading() {
  return (
    <div className="animate-fade-in space-y-6" role="status" aria-label="読み込み中">
      <Skeleton className="h-36 rounded-3xl sm:h-48" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <Skeleton className="aspect-[16/9] rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
