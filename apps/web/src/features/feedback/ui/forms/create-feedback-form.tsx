// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields.
import type { FeedbackAttachment } from "@cantiara/api/feedback";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { format } from "date-fns";
import { type FormEvent, useState } from "react";
import { DateTimePicker } from "@/components/date-picker";
import { createFeedbackFormSchema } from "../../lib/feedback-form";
import {
  type IdentityOption,
  IdentitySelect,
} from "../components/identity-select";

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

/** `datetime-local` value of "now" in the browser's zone. */
function localNow() {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm");
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
      const parsed = createFeedbackFormSchema.safeParse(value);
      if (!parsed.success) {
        setError(
          parsed.error.issues[0]?.message ??
            "Enter a Title, an Original message and Occurred at.",
        );
        return;
      }
      try {
        await onCreate(parsed.data);
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
    event.stopPropagation();
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
                  <DateTimePicker
                    ariaLabel="Occurred at"
                    disabled={pending}
                    id="feedback-occurred-at"
                    onChange={field.handleChange}
                    required
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
                        htmlFor={`feedback-attachment-${attachment.id}`}
                        key={attachment.id}
                      >
                        <Checkbox
                          checked={field.state.value.includes(attachment.id)}
                          disabled={pending}
                          id={`feedback-attachment-${attachment.id}`}
                          onCheckedChange={(checked) =>
                            field.handleChange(
                              checked
                                ? [...field.state.value, attachment.id]
                                : field.state.value.filter(
                                    (id) => id !== attachment.id,
                                  ),
                            )
                          }
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
