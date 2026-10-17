// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected record and form field.
import {
  FEEDBACK_STATUSES,
  type FeedbackAttachment,
  type FeedbackRecord,
  type FeedbackStatus,
} from "@cantiara/api/feedback";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";

export interface FeedbackDraft {
  attachmentIds: string[];
  channel: string | null;
  link: string | null;
  occurredAt: string;
  originalMessage: string;
  title: string;
}

type Create = (draft: FeedbackDraft) => Promise<unknown>;
type SetStatus = (
  record: FeedbackRecord,
  status: FeedbackStatus,
) => Promise<unknown>;

/** `datetime-local` value of "now" in the browser's zone. */
function localNow() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function toInstant(localValue: string) {
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function CreateFeedbackForm({
  attachmentOptions,
  onCreate,
}: {
  attachmentOptions: FeedbackAttachment[];
  onCreate: Create;
}) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: {
      attachmentIds: [] as string[],
      channel: "",
      link: "",
      occurredAt: localNow(),
      originalMessage: "",
      title: "",
    },
    onSubmit: async ({ value, formApi }) => {
      setError(undefined);
      const occurredAt = toInstant(value.occurredAt);
      if (!(value.title.trim() && value.originalMessage.trim() && occurredAt)) {
        setError("Enter a Title, an Original message and Occurred at.");
        return;
      }
      try {
        await onCreate({
          attachmentIds: value.attachmentIds,
          channel: value.channel.trim() || null,
          link: value.link.trim() || null,
          occurredAt,
          originalMessage: value.originalMessage,
          title: value.title,
        });
        formApi.reset({
          ...value,
          attachmentIds: [],
          channel: "",
          link: "",
          originalMessage: "",
          title: "",
          occurredAt: localNow(),
        });
      } catch {
        setError(
          "Feedback could not be saved. Check the Link and Attachments, then retry. Your text is kept here.",
        );
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">Create Feedback</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            <form.Field name="title">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor="feedback-title">Title</label>
                  <Input
                    disabled={pending}
                    id="feedback-title"
                    maxLength={255}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="originalMessage">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor="feedback-original-message">
                    Original message
                  </label>
                  <Textarea
                    disabled={pending}
                    id="feedback-original-message"
                    maxLength={20_000}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="channel">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor="feedback-channel">Channel (optional)</label>
                  <Input
                    disabled={pending}
                    id="feedback-channel"
                    maxLength={100}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="occurredAt">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor="feedback-occurred-at">Occurred at</label>
                  <Input
                    disabled={pending}
                    id="feedback-occurred-at"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    type="datetime-local"
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="link">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor="feedback-link">Link (optional)</label>
                  <Input
                    disabled={pending}
                    id="feedback-link"
                    inputMode="url"
                    maxLength={2048}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="https://"
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            {attachmentOptions.length > 0 ? (
              <form.Field name="attachmentIds">
                {(field) => (
                  <fieldset className="space-y-2" disabled={pending}>
                    <legend className="font-medium text-sm">Attachments</legend>
                    {attachmentOptions.map((attachment) => (
                      <label
                        className="flex min-h-11 items-center gap-3 text-sm"
                        key={attachment.id}
                      >
                        <input
                          checked={field.state.value.includes(attachment.id)}
                          onChange={(event) =>
                            field.handleChange(
                              event.target.checked
                                ? [...field.state.value, attachment.id]
                                : field.state.value.filter(
                                    (id) => id !== attachment.id,
                                  ),
                            )
                          }
                          type="checkbox"
                        />
                        <span>{attachment.name}</span>
                      </label>
                    ))}
                  </fieldset>
                )}
              </form.Field>
            ) : null}
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : "Create Feedback"}
            </Button>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}

function FeedbackRow({
  onSetStatus,
  readOnly,
  record,
}: {
  onSetStatus: SetStatus;
  readOnly: boolean;
  record: FeedbackRecord;
}) {
  const [error, setError] = useState<string>();
  async function change(status: FeedbackStatus) {
    setError(undefined);
    try {
      await onSetStatus(record, status);
    } catch {
      setError("Status could not be changed. Reload and try again.");
    }
  }
  return (
    <li className="space-y-3 rounded-lg border border-border/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-medium">{record.title}</h4>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={`feedback-status-${record.id}`}>Status</label>
          <NativeSelect
            disabled={readOnly}
            id={`feedback-status-${record.id}`}
            onChange={(event) => {
              change(event.target.value as FeedbackStatus).catch(
                () => undefined,
              );
            }}
            value={record.status}
          >
            {FEEDBACK_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {status}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <p className="whitespace-pre-wrap text-sm">{record.originalMessage}</p>
      <dl className="grid gap-1 text-muted-foreground text-xs">
        {record.channel ? (
          <div className="flex gap-2">
            <dt>Channel</dt>
            <dd>{record.channel}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt>Occurred at</dt>
          <dd>
            <time dateTime={record.occurredAt}>{record.occurredAt}</time>
          </dd>
        </div>
        {record.link ? (
          <div className="flex gap-2">
            <dt>Link</dt>
            <dd>
              <a
                className="underline"
                href={record.link}
                rel="noreferrer noopener"
                target="_blank"
              >
                {record.link}
              </a>
            </dd>
          </div>
        ) : null}
        {record.attachments.length > 0 ? (
          <div className="flex gap-2">
            <dt>Attachments</dt>
            <dd>{record.attachments.map(({ name }) => name).join(", ")}</dd>
          </div>
        ) : null}
      </dl>
    </li>
  );
}

export function FeedbackView({
  attachmentOptions,
  onCreate,
  onSetStatus,
  readOnly,
  records,
}: {
  attachmentOptions: FeedbackAttachment[];
  onCreate: Create;
  onSetStatus: SetStatus;
  readOnly: boolean;
  records: FeedbackRecord[];
}) {
  return (
    <section aria-labelledby="feedback-heading" className="space-y-4">
      <h2 className="font-semibold text-lg" id="feedback-heading">
        Feedback
      </h2>
      {readOnly ? null : (
        <CreateFeedbackForm
          attachmentOptions={attachmentOptions}
          onCreate={onCreate}
        />
      )}
      {records.length === 0 ? (
        <p className="text-muted-foreground text-sm">No Feedback yet.</p>
      ) : (
        <ul className="space-y-3">
          {records.map((record) => (
            <FeedbackRow
              key={record.id}
              onSetStatus={onSetStatus}
              readOnly={readOnly}
              record={record}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
