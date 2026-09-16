import { LoaderCircle } from "lucide-react";

interface GitHubWaitingStatusProps {
  visible: boolean;
}

export default function GitHubWaitingStatus({
  visible,
}: GitHubWaitingStatusProps) {
  if (!visible) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="mt-4 flex items-start gap-3 border bg-muted/40 px-3 py-3 text-left"
      role="status"
    >
      <span className="flex size-7 shrink-0 items-center justify-center border bg-background text-muted-foreground">
        <LoaderCircle
          aria-hidden="true"
          className="size-3.5 animate-spin motion-reduce:animate-none"
        />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium text-sm">Waiting for GitHub</p>
        <p className="text-muted-foreground text-xs/relaxed">
          GitHub is taking a moment to respond.
        </p>
      </div>
    </div>
  );
}
