import type { GitHubLinkPreview } from "@cantiara/api/github-integration";
import { Button } from "@cantiara/ui/components/button";
import { useEffect, useRef } from "react";

/**
 * Preview of what Reconnect or Disconnect touches. It is a labelled region that
 * takes focus when it opens, so a keyboard or screen-reader user lands on it,
 * and it names the confirm action explicitly.
 */
export function GitHubLinkPreviewPanel({
  action,
  error,
  linkId,
  onCancel,
  onConfirm,
  preview,
}: {
  action: GitHubLinkPreview["action"];
  error: boolean;
  linkId: string;
  onCancel: () => void;
  onConfirm: () => void;
  preview: GitHubLinkPreview | undefined;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const headingId = `github-preview-${linkId}`;
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-2 rounded-md border border-border p-3"
    >
      <h5 className="font-medium" id={headingId} ref={heading} tabIndex={-1}>
        {`${action} preview`}
      </h5>
      {error ? (
        <p className="text-destructive" role="alert">
          {`The ${action} preview is unavailable.`}
        </p>
      ) : null}
      {error || preview ? null : <p role="status">Loading preview…</p>}
      {preview ? (
        <>
          <p>{`Affects ${preview.affected.repository}: ${preview.affected.issues} Issues and ${preview.affected.pullRequests} Pull requests.`}</p>
          <ul className="list-disc pl-5">
            {preview.effects.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!preview}
          onClick={onConfirm}
          type="button"
          variant={action === "Disconnect" ? "destructive" : "default"}
        >
          {`Confirm ${action}`}
        </Button>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </section>
  );
}
