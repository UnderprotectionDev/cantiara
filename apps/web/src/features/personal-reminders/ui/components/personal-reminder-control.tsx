// biome-ignore-all lint/performance/noJsxPropsBind: Each control closes over one source record and its reminder list.

import {
  PERSONAL_REMINDER_CONDITIONAL_SOURCE_TYPES,
  type PersonalReminderAction,
  type PersonalReminderCondition,
  type PersonalReminderSourceType,
} from "@cantiara/api/personal-reminders";
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
  return (
    String(date.getFullYear()) +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
}

function defaultFireAt() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return localDateTimeValue(date);
}

function reminderErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Reminder could not be saved.";
}

function reminderStatusVariant(status: string) {
  return status === "Planned" ? "secondary" : "outline";
}

function supportsOpenCondition(sourceRecordType: PersonalReminderSourceType) {
  return PERSONAL_REMINDER_CONDITIONAL_SOURCE_TYPES.some(
    (conditionalType) => conditionalType === sourceRecordType,
  );
}

export default function PersonalReminderControl({
  compact = false,
  sourceRecordId,
  sourceRecordType,
  sourceTitle,
}: {
  compact?: boolean;
  sourceRecordId: string;
  sourceRecordType: PersonalReminderSourceType;
  sourceTitle: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<PersonalReminderAction>("Review Later");
  const [fireAt, setFireAt] = useState(defaultFireAt);
  const [condition, setCondition] =
    useState<PersonalReminderCondition>("In any case");
  const [error, setError] = useState<string | null>(null);
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const source = { sourceRecordId, sourceRecordType };
  const remindersQuery = useQuery({
    ...orpc.personalReminders.queryOptions({ input: source }),
    enabled: open,
  });

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: orpc.personalReminders.queryOptions({ input: source }).queryKey,
    });
  }

  const create = useMutation({
    mutationFn: (input: Parameters<typeof client.createPersonalReminder>[0]) =>
      runOnlineOnlyWrite(() => client.createPersonalReminder(input)),
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
      runOnlineOnlyWrite(() => client.cancelPersonalReminder({ reminderId })),
    onError: (mutationError) => setError(reminderErrorMessage(mutationError)),
    onSuccess: async () => {
      setError(null);
      await refresh();
    },
  });

  function openFor(nextAction: PersonalReminderAction) {
    setAction(nextAction);
    setFireAt(defaultFireAt());
    setError(null);
    setOpen(true);
  }

  function submit() {
    const fireAtDate = new Date(fireAt);
    if (!fireAt || Number.isNaN(fireAtDate.valueOf())) {
      setError("Choose a valid time.");
      return;
    }
    if (fireAtDate.valueOf() <= Date.now()) {
      setError("Reminder must be scheduled for a future time.");
      return;
    }
    const nextCondition =
      action === "Review Later" && supportsOpenCondition(sourceRecordType)
        ? condition
        : "In any case";
    const fingerprint = JSON.stringify({
      action,
      condition: nextCondition,
      fireAt: fireAtDate.toISOString(),
      sourceRecordId,
      sourceRecordType,
    });
    const clientIdempotencyKey =
      retry.current?.fingerprint === fingerprint
        ? retry.current.key
        : crypto.randomUUID();
    retry.current = { fingerprint, key: clientIdempotencyKey };
    setError(null);
    create.mutate({
      action,
      clientIdempotencyKey,
      condition: nextCondition,
      fireAt: fireAtDate.toISOString(),
      sourceRecordId,
      sourceRecordType,
    });
  }

  const pending = create.isPending || cancel.isPending;
  const showCondition =
    action === "Review Later" && supportsOpenCondition(sourceRecordType);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() => openFor("Remind me")}
          size={compact ? "sm" : "default"}
          type="button"
          variant="outline"
        >
          Remind me
        </Button>
        <Button
          disabled={pending}
          onClick={() => openFor("Review Later")}
          size={compact ? "sm" : "default"}
          type="button"
          variant="outline"
        >
          Review Later
        </Button>
      </div>
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
            <DialogTitle>{action}</DialogTitle>
            <DialogDescription>
              Choose when to return to {sourceTitle}. This reminder leaves the
              source status and planning unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor={`personal-reminder-when-${sourceRecordId}`}>
                When
              </FieldLabel>
              <Input
                id={`personal-reminder-when-${sourceRecordId}`}
                min={localDateTimeValue(new Date())}
                onChange={(event) => setFireAt(event.target.value)}
                required
                type="datetime-local"
                value={fireAt}
              />
            </Field>
            {showCondition ? (
              <Field>
                <FieldLabel
                  htmlFor={`personal-reminder-condition-${sourceRecordId}`}
                >
                  Condition
                </FieldLabel>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  id={`personal-reminder-condition-${sourceRecordId}`}
                  onChange={(event) =>
                    setCondition(
                      event.target.value as PersonalReminderCondition,
                    )
                  }
                  value={condition}
                >
                  <option value="In any case">In any case</option>
                  <option value="Only if still open">Only if still open</option>
                </select>
              </Field>
            ) : null}
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            {remindersQuery.isError ? (
              <p className="text-destructive text-sm" role="alert">
                Reminder history is unavailable. Try loading it again.
              </p>
            ) : null}
            <section aria-label="Reminder history" className="space-y-2">
              <h3 className="font-medium text-sm">History</h3>
              {remindersQuery.isPending ? (
                <p className="text-muted-foreground text-sm" role="status">
                  Loading reminders…
                </p>
              ) : null}
              {remindersQuery.data?.length === 0 ? (
                <p className="text-muted-foreground text-sm">No reminders.</p>
              ) : null}
              <ul className="space-y-2">
                {remindersQuery.data?.map((reminder) => (
                  <li
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border/70 p-3"
                    key={reminder.id}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={reminderStatusVariant(reminder.status)}>
                          {reminder.status}
                        </Badge>
                        <span className="text-xs">{reminder.action}</span>
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
              Set reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
