// biome-ignore-all lint/performance/noJsxPropsBind: Status buttons bind to their target status.

import {
  isTerminalProjectReleaseStatus,
  PROJECT_RELEASE_TERMINAL_STATUSES,
  type ProjectReleaseRecord,
  type ProjectReleaseStatus,
  type ProjectReleaseStatusSuggestion,
  projectReleaseStatusTargets,
} from "@cantiara/api/project-release-planning";
import {
  AlertDialog,
  type AlertDialogActions,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  createAlertDialogHandle,
} from "@cantiara/ui/components/alert-dialog";
import { Button } from "@cantiara/ui/components/button";
import { useRef, useState } from "react";
import { projectReleaseStatusChangeCopy } from "../../lib/project-release-planning-form";

type TerminalStatus = (typeof PROJECT_RELEASE_TERMINAL_STATUSES)[number];
const FREE_STATUSES = ["Draft", "Preparing"] as const;

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
  failed = false,
  saving = false,
  resetStatus,
}: {
  onChangeStatus: (status: ProjectReleaseStatus) => Promise<unknown>;
  openScope: number;
  readOnly: boolean;
  release: Pick<ProjectReleaseRecord, "status">;
  suggestion: ProjectReleaseStatusSuggestion | null;
  failed?: boolean;
  saving?: boolean;
  resetStatus?: () => void;
}) {
  const [handle] = useState(createAlertDialogHandle<TerminalStatus>);
  const actions = useRef<AlertDialogActions | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const committed = useRef<boolean>(false);
  const error = failed
    ? "Status could not be changed. Reload and try again."
    : null;
  const { status } = release;
  const targets = projectReleaseStatusTargets(status);
  const editable = !readOnly && targets.length > 0;

  async function confirm(next: TerminalStatus) {
    await onChangeStatus(next);
    committed.current = true;
    actions.current?.close();
  }

  return (
    <section aria-label="Status" className="space-y-3">
      <h3 className="text-lg font-medium" ref={heading} tabIndex={-1}>
        Status
      </h3>
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
                    onChangeStatus(free).catch(() => undefined);
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
            {PROJECT_RELEASE_TERMINAL_STATUSES.map((terminal) => (
              <AlertDialogTrigger
                disabled={saving}
                handle={handle}
                key={terminal}
                payload={terminal}
                render={<Button size="sm" variant="outline" />}
              >
                {`Mark ${terminal}`}
              </AlertDialogTrigger>
            ))}
          </div>
          {suggestion ? (
            <div
              className="space-y-2 rounded-lg border border-border/70 p-3 text-sm"
              role="note"
            >
              <p>{suggestion.reason}</p>
              <p>{`Mark this Project Release ${suggestion.status}?`}</p>
              <AlertDialogTrigger
                disabled={saving}
                handle={handle}
                payload={suggestion.status}
                render={<Button size="sm" variant="outline" />}
              >
                Review status change
              </AlertDialogTrigger>
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
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <AlertDialog
        actionsRef={actions}
        handle={handle}
        onOpenChange={(open, event) => {
          if (open) {
            committed.current = false;
            resetStatus?.();
          } else if (saving && event.reason !== "imperative-action") {
            event.cancel();
          }
        }}
      >
        {({ payload }) => {
          if (!payload) {
            return null;
          }
          const copy = projectReleaseStatusChangeCopy(payload, openScope);
          return (
            <AlertDialogContent
              finalFocus={() => (committed.current ? heading.current : true)}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>{copy.title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {copy.description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {copy.openScope ? (
                <p className="text-sm text-muted-foreground">
                  {copy.openScope}
                </p>
              ) : null}
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                <Button
                  disabled={saving}
                  onClick={() => {
                    confirm(payload).catch(() => undefined);
                  }}
                  type="button"
                  variant={payload === "Cancelled" ? "destructive" : "default"}
                >
                  {copy.action}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          );
        }}
      </AlertDialog>
    </section>
  );
}
