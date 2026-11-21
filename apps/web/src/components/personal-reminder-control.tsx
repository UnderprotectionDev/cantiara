// biome-ignore-all lint/performance/noJsxPropsBind: Each control closes over one source record and its reminder list.

import type { DocumentSection } from "@cantiara/api/documents";
import type {
  PersonalReminderAction,
  PersonalReminderSourceType,
} from "@cantiara/api/personal-reminders";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import {
  createDialogHandle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@cantiara/ui/components/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Dispatch, type SetStateAction, useState } from "react";
import {
  PersonalReminderForm,
  type ReminderRetry,
} from "@/components/personal-reminder-form";
import { accountDateTimeFormatter } from "@/features/account-preferences/lib/account-preferences-format";
import { client, orpc } from "@/utils/orpc";

function reminderErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Reminder could not be saved.";
}

function reminderStatusVariant(status: string) {
  return status === "Planned" ? "secondary" : "outline";
}

interface PersonalReminderControlProps {
  compact?: boolean;
  sectionOptions?: readonly Pick<DocumentSection, "heading" | "id">[];
  sourceRecordId: string;
  sourceRecordType: PersonalReminderSourceType;
  sourceTitle: string;
}

const reminderActions = ["Remind me", "Review Later"] as const;

export default function PersonalReminderControl({
  compact = false,
  ...source
}: PersonalReminderControlProps) {
  const [handle] = useState(createDialogHandle<PersonalReminderAction>);
  const [retry, setRetry] = useState<ReminderRetry | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {reminderActions.map((action) => (
          <DialogTrigger
            handle={handle}
            key={action}
            payload={action}
            render={
              <Button size={compact ? "sm" : "default"} variant="outline" />
            }
          >
            {action}
          </DialogTrigger>
        ))}
      </div>
      <Dialog handle={handle}>
        {({ payload }) =>
          payload ? (
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <PersonalReminderDialog
                {...source}
                action={payload}
                retry={retry}
                setRetry={setRetry}
              />
            </DialogContent>
          ) : null
        }
      </Dialog>
    </>
  );
}

function PersonalReminderDialog({
  action,
  retry,
  setRetry,
  sectionOptions = [],
  sourceRecordId,
  sourceRecordType,
  sourceTitle,
}: PersonalReminderControlProps & {
  action: PersonalReminderAction;
  retry: ReminderRetry | null;
  setRetry: Dispatch<SetStateAction<ReminderRetry | null>>;
}) {
  const queryClient = useQueryClient();
  const source = { sourceRecordId, sourceRecordType };
  const remindersQuery = useQuery({
    ...orpc.personalReminders.queryOptions({ input: source }),
  });

  const preferences = useQuery({
    ...orpc.accountPreferences.queryOptions(),
  });
  const formatDateTime = accountDateTimeFormatter(preferences.data);

  async function refresh(target: typeof source) {
    await queryClient.invalidateQueries({
      queryKey: orpc.personalReminders.queryKey({ input: target }),
    });
  }

  const create = useMutation(
    orpc.createPersonalReminder.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.createPersonalReminder(input),
      onSuccess: async (_, input) => {
        setRetry((previous) =>
          previous?.key === input.clientIdempotencyKey ? null : previous,
        );
        await refresh({
          sourceRecordId: input.sourceRecordId,
          sourceRecordType: input.sourceRecordType,
        });
      },
    }),
  );
  const cancel = useMutation({
    mutationKey: orpc.cancelPersonalReminder.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: ({ reminderId }: typeof source & { reminderId: string }) =>
      client.cancelPersonalReminder({ reminderId }),
    onSuccess: (
      _,
      { sourceRecordId: targetId, sourceRecordType: targetType },
    ) => refresh({ sourceRecordId: targetId, sourceRecordType: targetType }),
  });
  const failure = create.error ?? cancel.error;
  const error = failure ? reminderErrorMessage(failure) : null;

  const pending = create.isPending || cancel.isPending;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{action}</DialogTitle>
        <DialogDescription>
          Choose when to return to {sourceTitle}. This reminder leaves the
          source status and planning unchanged.
        </DialogDescription>
      </DialogHeader>
      <PersonalReminderForm
        action={action}
        createdKey={
          create.isSuccess ? create.variables.clientIdempotencyKey : undefined
        }
        onCreate={(input) => {
          cancel.reset();
          create.mutate(input);
        }}
        onRetry={setRetry}
        pending={pending}
        retry={retry}
        sectionOptions={sectionOptions}
        sourceRecordId={sourceRecordId}
        sourceRecordType={sourceRecordType}
      >
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {remindersQuery.isError ? (
          <p className="text-sm text-destructive" role="alert">
            Reminder history is unavailable. Try loading it again.
          </p>
        ) : null}
        <section aria-label="Reminder history" className="space-y-2">
          <h3 className="text-sm font-medium">History</h3>
          {remindersQuery.status === "pending" ? (
            <p className="text-sm text-muted-foreground" role="status">
              Loading reminders…
            </p>
          ) : null}
          {remindersQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reminders.</p>
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
                      className="text-xs text-muted-foreground"
                      dateTime={reminder.fireAt}
                    >
                      {formatDateTime(reminder.fireAt)}
                    </time>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {reminder.condition}
                  </p>
                  {reminder.fireNote ? (
                    <p className="text-xs text-muted-foreground">
                      {reminder.fireNote}
                    </p>
                  ) : null}
                </div>
                {reminder.status === "Planned" ? (
                  <Button
                    disabled={pending}
                    onClick={() => {
                      create.reset();
                      cancel.mutate({ ...source, reminderId: reminder.id });
                    }}
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
    </>
  );
}
