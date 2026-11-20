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
import { useForm, useSelector } from "@tanstack/react-form";
import { type SyntheticEvent, useId } from "react";
import { commandVariables } from "@/lib/command-variables";
import { submitForm } from "@/lib/submit-form";
import { isResearchSessionConflict } from "../../lib/research-session-conflict";

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
  previewState,
  confirmState,
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
  previewState?: ResearchBindingPreviewState;
  confirmState?: { error: unknown; isPending: boolean };
}) {
  const prefix = useId();
  const preview =
    previewState?.variables?.id === record.id &&
    previewState.variables.contentId === note.id
      ? previewState.data
      : undefined;
  const confirming = confirmState?.isPending ?? false;
  const conflict = isResearchSessionConflict(confirmState?.error);

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
      form.setErrorMap({ onSubmit: undefined });
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
        form.setErrorMap({
          onSubmit: {
            form: "Choose the target and complete its fields.",
            fields: {},
          },
        });
        return;
      }
      const { clientIdempotencyKey: _initialKey, ...input } = parsed.data;
      await onPreview(
        commandVariables(
          input,
          previewState?.error ? previewState.variables : undefined,
        ),
      );
    },
  });
  const validationError = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  let error = validationError;
  if (previewState?.error) {
    error = "Preview is unavailable. Retry or cancel; your draft is kept.";
  } else if (confirmState?.error) {
    error = conflict
      ? "Research Session changed or preview expired. Cancel and reopen the preview."
      : "Binding could not be confirmed. Retry with this same preview; your draft is kept.";
  }
  function selectText(event: SyntheticEvent<HTMLTextAreaElement>) {
    const { selectionStart, selectionEnd } = event.currentTarget;
    if (selectionEnd > selectionStart) {
      form.setFieldValue("start", selectionStart);
      form.setFieldValue("end", selectionEnd);
    }
  }
  function confirm() {
    if (preview && !confirming) {
      onConfirm(preview, preview.previewId).catch(() => undefined);
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
        <p className="text-sm text-destructive" role="alert">
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
                  <dt className="text-sm font-medium">
                    {fieldLabels[field] ?? field}
                  </dt>
                  <dd className="text-sm whitespace-pre-wrap">
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
          <blockquote className="border-l-4 pl-3 whitespace-pre-wrap">
            {preview.plan.pin.excerpt}
          </blockquote>
          <p className="text-sm text-muted-foreground">
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
            submitForm(form).catch(() => undefined);
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
                <p className="text-sm whitespace-pre-wrap">
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

export interface ResearchBindingPreviewState {
  data?: ResearchBindingPreview;
  error: unknown;
  reset: () => void;
  variables?: PreviewResearchSessionBindingInput;
}
