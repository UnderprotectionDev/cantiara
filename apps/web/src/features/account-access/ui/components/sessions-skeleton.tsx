import { Skeleton } from "@cantiara/ui/components/skeleton";

export default function SessionsSkeleton() {
  return (
    <div aria-label="Loading sessions" className="border-y" role="status">
      {[0, 1].map((item) => (
        <div
          className="flex items-center gap-3 border-b py-5 last:border-0"
          key={item}
        >
          <Skeleton className="size-8 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading sessions…</span>
    </div>
  );
}
