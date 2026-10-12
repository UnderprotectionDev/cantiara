// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to this explicit conversion draft.
import {
  type PreviewResearchSessionBindingInput,
  previewResearchSessionBindingInputSchema,
  RESEARCH_BINDING_TARGET_TYPES,
  type ResearchBindingFeedback,
  type ResearchBindingPreview,
  type ResearchBindingTargets,
  type ResearchEvidenceBinding,
} from "@cantiara/api/research-session-bindings";
import type {
  ResearchSessionNoteInput,
  ResearchSessionRecord,
} from "@cantiara/api/research-sessions";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type SyntheticEvent, useId, useState } from "react";

const fieldLabels: Record<string, string> = {
  title: "Title",
  workType: "Work type",
  statement: "Statement",
  question: "Question",
  decision: "Decision",
  description: "Description",
  originalMessage: "Original message",
  channel: "Channel",
  occurredAt: "Time",
};
export function ResearchNoteBindingEditor({
  record,
  note,
  mode,
  targets,
  onPreview,
  onConfirm,
  onCancel,
}: {
  record: Pick<
    ResearchSessionRecord,
    "id" | "projectId" | "revision" | "title"
  >;
  note: ResearchSessionNoteInput;
  mode: "create" | "bind";
  targets: ResearchBindingTargets;
  onPreview: (
    input: PreviewResearchSessionBindingInput,
  ) => Promise<ResearchBindingPreview>;
  onConfirm: (
    preview: ResearchBindingPreview,
    key: string,
  ) => Promise<ResearchEvidenceBinding>;
  onCancel: () => void;
}) {
  const prefix = useId();
  const [preview, setPreview] = useState<ResearchBindingPreview>();
  const [confirmationKey, setConfirmationKey] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const form = useForm({
    defaultValues: {
      type: "",
      projectId: record.projectId,
      recordId: "",
      title: "",
      workType: "",
      start: 0,
      end: note.text.length,
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const parsed = previewResearchSessionBindingInputSchema.safeParse({
        id: record.id,
        projectId: record.projectId,
        baseRevision: record.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        contentId: note.id,
        start: value.start,
        end: value.end,
        target: {
          mode,
          type: value.type,
          projectId: value.projectId,
          ...(mode === "create"
            ? {
                title: value.title,
                ...(value.type === "Work" ? { workType: value.workType } : {}),
              }
            : { recordId: value.recordId }),
        },
      });
      if (!parsed.success) {
        setError("Choose the target and complete its fields.");
        return;
      }
      try {
        setPreview(await onPreview(parsed.data));
        setConfirmationKey(crypto.randomUUID());
      } catch {
        setError(
          "Preview is unavailable. Retry or cancel; your draft is kept.",
        );
      }
    },
  });
  function selectText(event: SyntheticEvent<HTMLTextAreaElement>) {
    const { selectionStart, selectionEnd } = event.currentTarget;
    if (selectionEnd > selectionStart) {
      form.setFieldValue("start", selectionStart);
      form.setFieldValue("end", selectionEnd);
    }
  }
  async function confirm() {
    if (!preview || confirming) {
      return;
    }
    setConfirming(true);
    setError(undefined);
    try {
      await onConfirm(preview, confirmationKey);
    } catch (cause) {
      const changed =
        cause instanceof Error && "code" in cause && cause.code === "CONFLICT";
      setConflict(changed);
      setError(
        changed
          ? "Research Session changed or preview expired. Cancel and reopen the preview."
          : "Binding could not be confirmed. Retry with this same preview; your draft is kept.",
      );
    } finally {
      setConfirming(false);
    }
  }
  const confirmationLabel = error ? "Retry" : "Confirm";
  const heading =
    mode === "create"
      ? "Convert to new record and bind"
      : "Bind as evidence to existing record";
  return (
    <section aria-label={heading} className="space-y-3 rounded-lg border p-4">
      <h5 className="font-medium">{heading}</h5>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {preview ? (
        <div className="space-y-3">
          <h6 className="font-medium">Preview</h6>
          <p>Target type: {preview.plan.target.type}</p>
          <p>Target Project: {preview.targetProjectName}</p>
          <p>Target record: {preview.targetLabel}</p>
          {preview.plan.target.mode === "create" ? (
            <dl aria-label="Field mappings" className="space-y-2">
              {Object.entries(preview.plan.fields).map(([field, value]) => (
                <div key={field}>
                  <dt className="font-medium text-sm">
                    {fieldLabels[field] ?? field}
                  </dt>
                  <dd className="whitespace-pre-wrap text-sm">
                    {value ?? "Not set"}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <p>
            {preview.plan.target.mode === "create"
              ? "Origin"
              : "Evidence source"}
            : Research Session · {record.title}
          </p>
          <p>Origin Location: {note.kind}</p>
          <p>
            Version-pinned evidence: revision {preview.plan.pin.source.revision}
            , range {preview.plan.pin.start}–{preview.plan.pin.end}
          </p>
          <blockquote className="whitespace-pre-wrap border-l-4 pl-3">
            {preview.plan.pin.excerpt}
          </blockquote>
          <p className="text-muted-foreground text-sm">
            The original note stays in this Research Session.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={confirming || conflict} onClick={confirm}>
              {confirming ? "Confirming…" : <span>{confirmationLabel}</span>}
            </Button>
            <Button disabled={confirming} onClick={onCancel} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit().catch(() => undefined);
          }}
        >
          <form.Subscribe
            selector={(state) => ({
              values: state.values,
              pending: state.isSubmitting,
            })}
          >
            {({ values, pending }) => (
              <fieldset className="space-y-3" disabled={pending}>
                <div className="grid gap-2 text-sm">
                  <label htmlFor={`${prefix}-text`}>Selected text</label>
                  <Textarea
                    id={`${prefix}-text`}
                    onKeyUp={selectText}
                    onMouseUp={selectText}
                    onSelect={selectText}
                    readOnly
                    value={note.text}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <form.Field name="start">
                    {(field) => (
                      <div className="grid gap-2 text-sm">
                        <label htmlFor={`${prefix}-start`}>
                          Selection start
                        </label>
                        <Input
                          id={`${prefix}-start`}
                          max={note.text.length - 1}
                          min={0}
                          onChange={(event) =>
                            field.handleChange(event.target.valueAsNumber)
                          }
                          required
                          step={1}
                          type="number"
                          value={field.state.value}
                        />
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="end">
                    {(field) => (
                      <div className="grid gap-2 text-sm">
                        <label htmlFor={`${prefix}-end`}>Selection end</label>
                        <Input
                          id={`${prefix}-end`}
                          max={note.text.length}
                          min={1}
                          onChange={(event) =>
                            field.handleChange(event.target.valueAsNumber)
                          }
                          required
                          step={1}
                          type="number"
                          value={field.state.value}
                        />
                      </div>
                    )}
                  </form.Field>
                </div>
                <p className="whitespace-pre-wrap text-sm">
                  Range {values.start}–{values.end}:{" "}
                  {note.text.slice(values.start, values.end)}
                </p>
                <form.Field name="type">
                  {(field) => (
                    <div className="grid gap-2 text-sm">
                      <label htmlFor={`${prefix}-type`}>Target type</label>
                      <NativeSelect
                        id={`${prefix}-type`}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          form.setFieldValue("recordId", "");
                        }}
                        value={field.state.value}
                      >
                        <NativeSelectOption value="">
                          Choose target type
                        </NativeSelectOption>
                        {RESEARCH_BINDING_TARGET_TYPES.map((type) => (
                          <NativeSelectOption key={type} value={type}>
                            {type}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                  )}
                </form.Field>
                <form.Field name="projectId">
                  {(field) => (
                    <div className="grid gap-2 text-sm">
                      <label htmlFor={`${prefix}-project`}>
                        Target Project
                      </label>
                      <NativeSelect
                        id={`${prefix}-project`}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          form.setFieldValue("recordId", "");
                        }}
                        value={field.state.value}
                      >
                        {targets.projects.map((project) => (
                          <NativeSelectOption
                            key={project.id}
                            value={project.id}
                          >
                            {project.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                  )}
                </form.Field>
                {mode === "create" ? (
                  <>
                    <form.Field name="title">
                      {(field) => (
                        <div className="grid gap-2 text-sm">
                          <label htmlFor={`${prefix}-title`}>Title</label>
                          <Input
                            id={`${prefix}-title`}
                            maxLength={255}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            required
                            value={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                    {values.type === "Work" ? (
                      <form.Field name="workType">
                        {(field) => (
                          <div className="grid gap-2 text-sm">
                            <label htmlFor={`${prefix}-work-type`}>
                              Work type
                            </label>
                            <NativeSelect
                              id={`${prefix}-work-type`}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              value={field.state.value}
                            >
                              <NativeSelectOption value="">
                                Choose Work type
                              </NativeSelectOption>
                              {["Task", "Bug", "Research", "Improvement"].map(
                                (type) => (
                                  <NativeSelectOption key={type} value={type}>
                                    {type}
                                  </NativeSelectOption>
                                ),
                              )}
                            </NativeSelect>
                          </div>
                        )}
                      </form.Field>
                    ) : null}
                  </>
                ) : (
                  <form.Field name="recordId">
                    {(field) => (
                      <div className="grid gap-2 text-sm">
                        <label htmlFor={`${prefix}-record`}>
                          Target record
                        </label>
                        <NativeSelect
                          id={`${prefix}-record`}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          value={field.state.value}
                        >
                          <NativeSelectOption value="">
                            Choose target record
                          </NativeSelectOption>
                          {targets.records
                            .filter(
                              (item) =>
                                item.projectId === values.projectId &&
                                item.type === values.type,
                            )
                            .map((item) => (
                              <NativeSelectOption key={item.id} value={item.id}>
                                {item.title}
                              </NativeSelectOption>
                            ))}
                        </NativeSelect>
                      </div>
                    )}
                  </form.Field>
                )}
                <div className="flex gap-2">
                  <Button disabled={!values.type} type="submit">
                    {pending ? "Loading…" : "Preview"}
                  </Button>
                  <Button onClick={onCancel} type="button" variant="outline">
                    Cancel
                  </Button>
                </div>
              </fieldset>
            )}
          </form.Subscribe>
        </form>
      )}
    </section>
  );
}

export interface ResearchBindingActions {
  confirm: (
    record: ResearchSessionRecord,
    preview: ResearchBindingPreview,
    key: string,
  ) => Promise<ResearchEvidenceBinding>;
  feedback?: (
    record: ResearchSessionRecord,
    bindingId: string,
  ) => Promise<ResearchBindingFeedback>;
  list: (record: ResearchSessionRecord) => Promise<ResearchEvidenceBinding[]>;
  preview: (
    input: PreviewResearchSessionBindingInput,
  ) => Promise<ResearchBindingPreview>;
  targets: (record: ResearchSessionRecord) => Promise<ResearchBindingTargets>;
}
