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
import {
  type ConfirmConvert,
  ConvertToWorkDialog,
  type PreviewConvert,
} from "./convert-to-work-dialog";
import {
  EvidenceQualityPanel,
  type SaveEvidence,
} from "./evidence-quality-panel";

export interface IdentityOption {
  id: string;
  name: string;
}

export interface FeedbackDraft {
  attachmentIds: string[];
  channel: string | null;
  companyId: string | null;
  contactId: string | null;
  link: string | null;
  occurredAt: string;
  originalMessage: string;
  title: string;
}

type Create = (draft: FeedbackDraft) => Promise<unknown>;
type SetIdentity = (
  record: FeedbackRecord,
  identity: { companyId: string | null; contactId: string | null },
) => Promise<unknown>;
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

function IdentitySelect({
  disabled,
  id,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: IdentityOption[];
  value: string;
}) {
  return (
    <div className="grid gap-2 text-sm">
      <label htmlFor={id}>{label}</label>
      <NativeSelect
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <NativeSelectOption value="">Unknown</NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option.id} value={option.id}>
            {option.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export function CreateFeedbackForm({
  attachmentOptions,
  companyOptions,
  contactOptions,
  onCreate,
}: {
  attachmentOptions: FeedbackAttachment[];
  companyOptions: IdentityOption[];
  contactOptions: IdentityOption[];
  onCreate: Create;
}) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: {
      attachmentIds: [] as string[],
      channel: "",
      companyId: "",
      contactId: "",
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
          companyId: value.companyId || null,
          contactId: value.contactId || null,
          link: value.link.trim() || null,
          occurredAt,
          originalMessage: value.originalMessage,
          title: value.title,
        });
        formApi.reset({
          ...value,
          attachmentIds: [],
          channel: "",
          companyId: "",
          contactId: "",
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
                  <label htmlFor="feedback-channel">Channel</label>
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
            <form.Field name="contactId">
              {(field) => (
                <IdentitySelect
                  disabled={pending}
                  id="feedback-contact"
                  label="Contact (optional)"
                  onChange={field.handleChange}
                  options={contactOptions}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <form.Field name="companyId">
              {(field) => (
                <IdentitySelect
                  disabled={pending}
                  id="feedback-company"
                  label="Company (optional)"
                  onChange={field.handleChange}
                  options={companyOptions}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <form.Field name="link">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor="feedback-link">Link</label>
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
  companyOptions,
  contactOptions,
  onConfirmConvert,
  onPreviewConvert,
  onSaveEvidence,
  onSetIdentity,
  onSetStatus,
  readOnly,
  record,
}: {
  companyOptions: IdentityOption[];
  contactOptions: IdentityOption[];
  onConfirmConvert: (record: FeedbackRecord) => ConfirmConvert;
  onPreviewConvert: (record: FeedbackRecord) => PreviewConvert;
  onSaveEvidence: (record: FeedbackRecord) => SaveEvidence;
  onSetIdentity: SetIdentity;
  onSetStatus: SetStatus;
  readOnly: boolean;
  record: FeedbackRecord;
}) {
  const [error, setError] = useState<string>();
  const [converting, setConverting] = useState(false);
  async function changeIdentity(next: {
    companyId?: string | null;
    contactId?: string | null;
  }) {
    setError(undefined);
    try {
      await onSetIdentity(record, {
        companyId:
          next.companyId === undefined
            ? (record.company?.id ?? null)
            : next.companyId,
        contactId:
          next.contactId === undefined
            ? (record.contact?.id ?? null)
            : next.contactId,
      });
    } catch {
      setError(
        "Contact or Company could not be changed. Reload and try again.",
      );
    }
  }
  async function change(status: FeedbackStatus) {
    setError(undefined);
    try {
      await onSetStatus(record, status);
    } catch {
      setError("Status could not be changed. Reload and try again.");
    }
  }
  return (
    <li
      className="space-y-3 rounded-lg border border-border/70 p-4"
      id={`feedback-record-${record.id}`}
      tabIndex={-1}
    >
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
      <div className="grid gap-3 sm:grid-cols-2">
        <IdentitySelect
          disabled={readOnly}
          id={`feedback-contact-${record.id}`}
          label="Contact (optional)"
          onChange={(value) => {
            changeIdentity({ contactId: value || null }).catch(() => undefined);
          }}
          options={contactOptions}
          value={record.contact?.id ?? ""}
        />
        <IdentitySelect
          disabled={readOnly}
          id={`feedback-company-${record.id}`}
          label="Company (optional)"
          onChange={(value) => {
            changeIdentity({ companyId: value || null }).catch(() => undefined);
          }}
          options={companyOptions}
          value={record.company?.id ?? ""}
        />
      </div>
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
      {record.workOrigins.length > 0 ? (
        <section aria-label="Origin of Work" className="space-y-1 text-sm">
          <h5 className="font-medium">Origin of</h5>
          <ul>
            {record.workOrigins.map((origin) => (
              <li className="space-y-2" key={origin.id}>
                <p>
                  {origin.workKey} {origin.workTitle}
                </p>
                <EvidenceQualityPanel
                  onSave={onSaveEvidence(record)}
                  origin={origin}
                  readOnly={readOnly}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {readOnly ? null : (
        <Button
          onClick={() => setConverting(true)}
          type="button"
          variant="outline"
        >
          Convert to Work
        </Button>
      )}
      {converting ? (
        <ConvertToWorkDialog
          onClose={() => setConverting(false)}
          onConfirm={onConfirmConvert(record)}
          onPreview={onPreviewConvert(record)}
          record={record}
        />
      ) : null}
    </li>
  );
}

export function FeedbackView({
  attachmentOptions,
  companyOptions,
  contactOptions,
  onConfirmConvert,
  onCreate,
  onPreviewConvert,
  onSaveEvidence,
  onSetIdentity,
  onSetStatus,
  readOnly,
  records,
}: {
  attachmentOptions: FeedbackAttachment[];
  companyOptions: IdentityOption[];
  contactOptions: IdentityOption[];
  onConfirmConvert: (record: FeedbackRecord) => ConfirmConvert;
  onCreate: Create;
  onPreviewConvert: (record: FeedbackRecord) => PreviewConvert;
  onSaveEvidence: (record: FeedbackRecord) => SaveEvidence;
  onSetIdentity: SetIdentity;
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
          companyOptions={companyOptions}
          contactOptions={contactOptions}
          onCreate={onCreate}
        />
      )}
      {records.length === 0 ? (
        <p className="text-muted-foreground text-sm">No Feedback yet.</p>
      ) : (
        <ul className="space-y-3">
          {records.map((record) => (
            <FeedbackRow
              companyOptions={companyOptions}
              contactOptions={contactOptions}
              key={record.id}
              onConfirmConvert={onConfirmConvert}
              onPreviewConvert={onPreviewConvert}
              onSaveEvidence={onSaveEvidence}
              onSetIdentity={onSetIdentity}
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
