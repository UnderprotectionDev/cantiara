// biome-ignore-all lint/performance/noJsxPropsBind: Each control closes over one Work and its reminder list.

import type { PersonalReminderCondition } from "@cantiara/api/personal-reminders";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

function localDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultFireAt() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return localDateTimeValue(date);
}

function reminderErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Review Later could not be saved.";
}

function reminderStatusVariant(status: string) {
  return status === "Planned" ? "secondary" : "outline";
}

export default function WorkReviewLaterControl({
  compact = false,
  work,
}: {
  compact?: boolean;
  work: WorkProfile;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fireAt, setFireAt] = useState(defaultFireAt);
  const [condition, setCondition] =
    useState<PersonalReminderCondition>("In any case");
  const [error, setError] = useState<string | null>(null);
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const remindersQuery = useQuery({
    ...orpc.workReviewLater.queryOptions({ input: { workId: work.id } }),
    enabled: open,
  });

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: orpc.workReviewLater.queryOptions({
        input: { workId: work.id },
      }).queryKey,
    });
  }

  const create = useMutation({
    mutationFn: (input: Parameters<typeof client.createWorkReviewLater>[0]) =>
      runOnlineOnlyWrite(() => client.createWorkReviewLater(input)),
    onError: (mutationError) => setError(reminderErrorMessage(mutationError)),
    onSuccess: async () => {
      retry.current = null;
      setError(null);
      setFireAt(defaultFireAt());
      await refresh();
    },
  });

  const cancel = useMutation({
    mutationFn: (reminderId: string) =>
      runOnlineOnlyWrite(() => client.cancelWorkReviewLater({ reminderId })),
    onError: (mutationError) => setError(reminderErrorMessage(mutationError)),
    onSuccess: async () => {
      setError(null);
      await refresh();
    },
  });

  function submit() {
    const fireAtDate = new Date(fireAt);
    if (!fireAt || Number.isNaN(fireAtDate.valueOf())) {
      setError("Choose a valid time.");
      return;
    }
    if (fireAtDate.valueOf() <= Date.now()) {
      setError("Review Later must be scheduled for a future time.");
      return;
    }
    const fingerprint = JSON.stringify({
      condition,
      fireAt: fireAtDate.toISOString(),
      workId: work.id,
    });
    const clientIdempotencyKey =
      retry.current?.fingerprint === fingerprint
        ? retry.current.key
        : crypto.randomUUID();
    retry.current = { fingerprint, key: clientIdempotencyKey };
    setError(null);
    create.mutate({
      clientIdempotencyKey,
      condition,
      fireAt: fireAtDate.toISOString(),
      workId: work.id,
    });
  }

  const pending = create.isPending || cancel.isPending;
  return (
    <>
      <Button
        disabled={pending}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        size={compact ? "sm" : "default"}
        type="button"
        variant="outline"
      >
        Review Later
      </Button>
      <Dialog
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) {
            setFireAt(defaultFireAt());
            setError(null);
          }
        }}
        open={open}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Later</DialogTitle>
            <DialogDescription>
              Choose when to return to {work.key}. This reminder leaves Work
              status and planning unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor={`review-later-when-${work.id}`}>
                When
              </FieldLabel>
              <Input
                id={`review-later-when-${work.id}`}
                min={localDateTimeValue(new Date())}
                onChange={(event) => setFireAt(event.target.value)}
                required
                type="datetime-local"
                value={fireAt}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`review-later-condition-${work.id}`}>
                Condition
              </FieldLabel>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                id={`review-later-condition-${work.id}`}
                onChange={(event) =>
                  setCondition(event.target.value as PersonalReminderCondition)
                }
                value={condition}
              >
                <option value="In any case">In any case</option>
                <option value="Only if still open">Only if still open</option>
              </select>
            </Field>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            {remindersQuery.isError ? (
              <p className="text-destructive text-sm" role="alert">
                Review Later history is unavailable. Try loading it again.
              </p>
            ) : null}
            <section aria-label="Review Later history" className="space-y-2">
              <h3 className="font-medium text-sm">History</h3>
              {remindersQuery.isPending ? (
                <p className="text-muted-foreground text-sm" role="status">
                  Loading reminders…
                </p>
              ) : null}
              {remindersQuery.data?.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No Review Later reminders.
                </p>
              ) : null}
              <ul className="space-y-2">
                {remindersQuery.data?.map((reminder) => (
                  <li
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border/70 p-3"
                    key={reminder.id}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={reminderStatusVariant(reminder.status)}>
                          {reminder.status}
                        </Badge>
                        <time
                          className="text-muted-foreground text-xs"
                          dateTime={reminder.fireAt}
                        >
                          {new Date(reminder.fireAt).toLocaleString()}
                        </time>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {reminder.condition}
                      </p>
                      {reminder.fireNote ? (
                        <p className="text-muted-foreground text-xs">
                          {reminder.fireNote}
                        </p>
                      ) : null}
                    </div>
                    {reminder.status === "Planned" ? (
                      <Button
                        disabled={pending}
                        onClick={() => cancel.mutate(reminder.id)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <DialogFooter>
            <Button
              disabled={pending || !fireAt}
              onClick={submit}
              type="button"
            >
              Set Review Later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
