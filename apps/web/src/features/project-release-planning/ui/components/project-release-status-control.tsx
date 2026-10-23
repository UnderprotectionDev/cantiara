// biome-ignore-all lint/performance/noJsxPropsBind: Status buttons bind to their target status.

import {
  isTerminalProjectReleaseStatus,
  type ProjectReleaseRecord,
  type ProjectReleaseStatus,
  type ProjectReleaseStatusSuggestion,
  projectReleaseStatusTargets,
} from "@cantiara/api/project-release-planning";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@cantiara/ui/components/alert-dialog";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import { projectReleaseStatusChangeCopy } from "../../lib/project-release-planning-form";

type TerminalStatus = "Published" | "Cancelled";
const FREE_STATUSES = ["Draft", "Preparing"] as const;
const TERMINAL_STATUSES = ["Published", "Cancelled"] as const;

/**
 * Sidebar status of 16.2 and the 16.4 Change Release Status dialog. `Draft`
 * and `Preparing` switch in place; `Published` and `Cancelled` are written
 * only after the founder confirms. A GitHub Release suggestion only opens the
 * dialog; it never writes.
 */
export function ProjectReleaseStatusControl({
  onChangeStatus,
  openScope,
  readOnly,
  release,
  suggestion,
}: {
  onChangeStatus: (status: ProjectReleaseStatus) => Promise<unknown>;
  openScope: number;
  readOnly: boolean;
  release: Pick<ProjectReleaseRecord, "status">;
  suggestion: ProjectReleaseStatusSuggestion | null;
}) {
  const [confirming, setConfirming] = useState<TerminalStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { status } = release;
  const targets = projectReleaseStatusTargets(status);
  const editable = !readOnly && targets.length > 0;

  async function change(next: ProjectReleaseStatus) {
    setError(null);
    setSaving(true);
    try {
      await onChangeStatus(next);
      setConfirming(null);
    } catch {
      setError("Status could not be changed. Reload and try again.");
    } finally {
      setSaving(false);
    }
  }

  const copy = confirming
    ? projectReleaseStatusChangeCopy(confirming, openScope)
    : null;
  return (
    <section aria-label="Status" className="space-y-3">
      <h3 className="font-medium text-lg">Status</h3>
      {editable ? (
        <>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Status</legend>
            {FREE_STATUSES.map((free) => (
              <Button
                aria-pressed={status === free}
                disabled={saving}
                key={free}
                onClick={() => {
                  if (status !== free) {
                    change(free).catch(() => undefined);
                  }
                }}
                size="sm"
                type="button"
                variant={status === free ? "default" : "outline"}
              >
                {free}
              </Button>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            {TERMINAL_STATUSES.map((terminal) => (
              <Button
                disabled={saving}
                key={terminal}
                onClick={() => setConfirming(terminal)}
                size="sm"
                type="button"
                variant="outline"
              >
                {`Mark ${terminal}`}
              </Button>
            ))}
          </div>
          {suggestion ? (
            <div
              className="space-y-2 rounded-lg border border-border/70 p-3 text-sm"
              role="note"
            >
              <p>{suggestion.reason}</p>
              <p>{`Mark this Project Release ${suggestion.status}?`}</p>
              <Button
                disabled={saving}
                onClick={() => setConfirming(suggestion.status)}
                size="sm"
                type="button"
                variant="outline"
              >
                Review status change
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="font-medium">{status}</p>
          {isTerminalProjectReleaseStatus(status) ? (
            <p className="text-muted-foreground">
              {`${status} is final; the status cannot change.`}
            </p>
          ) : null}
        </div>
      )}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <AlertDialog
        onOpenChange={(open) => {
          if (!(open || saving)) {
            setConfirming(null);
          }
        }}
        open={confirming !== null}
      >
        {copy && confirming ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{copy.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {copy.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {copy.openScope ? (
              <p className="text-muted-foreground text-sm">{copy.openScope}</p>
            ) : null}
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
              <Button
                disabled={saving}
                onClick={() => {
                  change(confirming).catch(() => undefined);
                }}
                type="button"
                variant={confirming === "Cancelled" ? "destructive" : "default"}
              >
                {copy.action}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </section>
  );
}
