// biome-ignore-all lint/performance/noJsxPropsBind: Each control closes over one source record and its reminder list.

import type { DocumentSection } from "@cantiara/api/documents";
import type {
  PersonalReminderAction,
  PersonalReminderSourceType,
} from "@cantiara/api/personal-reminders";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { PersonalReminderForm } from "@/components/personal-reminder-form";
import { accountDateTimeFormatter } from "@/features/account-preferences/lib/account-preferences-format";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

function reminderErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Reminder could not be saved.";
}

function reminderStatusVariant(status: string) {
  return status === "Planned" ? "secondary" : "outline";
}

export default function PersonalReminderControl({
  compact = false,
  sectionOptions = [],
  sourceRecordId,
  sourceRecordType,
  sourceTitle,
}: {
  compact?: boolean;
  sectionOptions?: readonly Pick<DocumentSection, "heading" | "id">[];
  sourceRecordId: string;
  sourceRecordType: PersonalReminderSourceType;
  sourceTitle: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<PersonalReminderAction>("Review Later");
  const [error, setError] = useState<string | null>(null);
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const source = { sourceRecordId, sourceRecordType };
  const remindersQuery = useQuery({
    ...orpc.personalReminders.queryOptions({ input: source }),
    enabled: open,
  });

  const preferences = useQuery({
    ...orpc.accountPreferences.queryOptions(),
    enabled: open,
  });
  const formatDateTime = accountDateTimeFormatter(preferences.data);

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
    setError(null);
    setOpen(true);
  }

  const pending = create.isPending || cancel.isPending;
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
          <PersonalReminderForm
            action={action}
            onCreate={(input, onSuccess) => create.mutate(input, { onSuccess })}
            onError={setError}
            pending={pending}
            retry={retry}
            sectionOptions={sectionOptions}
            sourceRecordId={sourceRecordId}
            sourceRecordType={sourceRecordType}
          >
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
                          {formatDateTime(reminder.fireAt)}
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
          </PersonalReminderForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
