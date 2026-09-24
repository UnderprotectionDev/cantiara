import { buttonVariants } from "@cantiara/ui/components/button";
import { Link } from "@tanstack/react-router";
import { FolderOpen, Plus } from "lucide-react";

export function ProjectsEmptyState() {
  return (
    <div className="rounded-lg border border-border/80 border-dashed bg-card/45 px-5 py-10 sm:px-6">
      <div className="flex max-w-2xl items-start gap-4">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
          <FolderOpen aria-hidden="true" className="size-4" />
        </div>
        <div>
          <p className="font-medium">No Projects yet.</p>
          <p className="mt-1 max-w-xl text-muted-foreground text-sm/relaxed">
            Start with a name and one Starter Configuration. Add the rest when
            the Project needs more shape.
          </p>
          <Link
            className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-5 min-h-11`}
            to="/projects/new"
          >
            <Plus aria-hidden="true" />
            Create your first Project
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ProjectsSkeleton() {
  return (
    <div aria-label="Loading…" className="divide-y border-y" role="status">
      {[0, 1].map((item) => (
        <div
          className="grid gap-4 py-6 lg:grid-cols-[minmax(0,1fr)_18rem]"
          key={item}
        >
          <div className="space-y-2">
            <div className="h-4 w-48 animate-pulse bg-muted" />
            <div className="h-3 w-32 animate-pulse bg-muted" />
          </div>
          <div className="h-8 animate-pulse bg-muted" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
