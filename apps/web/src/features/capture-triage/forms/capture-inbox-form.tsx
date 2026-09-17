import {
  CAPTURE_TEMPLATE_FIELD_LABELS,
  CAPTURE_TEMPLATES,
  type CaptureTemplate,
} from "@cantiara/api/capture-triage";
import { Button } from "@cantiara/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";

import {
  useClientShell,
  useClientShellConnection,
} from "@/features/web-macos-client/views/client-shell";
import { captureInboxQueryOptions, client } from "@/utils/orpc";

interface CaptureFormValues {
  content: string;
  fields: Record<string, string>;
  projectId: string;
  template: "" | CaptureTemplate;
}

function selectCreateBugValues(state: { values: CaptureFormValues }) {
  return {
    projectId: state.values.projectId,
    template: state.values.template || null,
  };
}

const EMPTY_FORM_VALUES: CaptureFormValues = {
  content: "",
  fields: {},
  projectId: "",
  template: "",
};

export function canCreateBug(
  projectId: string,
  template: CaptureTemplate | null,
) {
  return (
    projectId.trim().length > 0 &&
    (template === null || template === "Bug Capture")
  );
}

function captureInput(values: CaptureFormValues, clientIdempotencyKey: string) {
  return {
    clientIdempotencyKey,
    content: values.content,
    fields: Object.fromEntries(
      Object.entries(values.fields).filter(([, value]) => value.length > 0),
    ),
    projectId: values.projectId.trim() || null,
    template: values.template || null,
  };
}

export default function CaptureInboxForm({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient();
  const shell = useClientShell();
  const connection = useClientShellConnection();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const pendingCaptureKey = useRef<string | null>(null);
  const pendingBugKey = useRef<string | null>(null);

  const createCapture = useMutation({
    mutationFn: (input: ReturnType<typeof captureInput>) =>
      shell.runWrite(() => client.createCapture(input)),
    onError: () => setActionMessage("Capture could not be saved."),
    onSuccess: async () => {
      pendingCaptureKey.current = null;
      setActionMessage("Capture saved.");
      await queryClient.invalidateQueries({
        queryKey: captureInboxQueryOptions(accountId).queryKey,
      });
    },
  });

  const createBug = useMutation({
    mutationFn: (input: ReturnType<typeof captureInput>) =>
      shell.runWrite(() => client.createBug(input)),
    onError: () => setActionMessage("Create Bug could not be completed."),
    onSuccess: () => {
      pendingBugKey.current = null;
      setActionMessage(
        "Create Bug does not stay in the Capture Inbox. A Work record is not stored yet.",
      );
    },
  });

  const form = useForm({
    defaultValues: EMPTY_FORM_VALUES,
    onSubmit: async ({ value }) => {
      const key = pendingCaptureKey.current ?? crypto.randomUUID();
      pendingCaptureKey.current = key;
      await createCapture.mutateAsync(captureInput(value, key));
      form.reset();
    },
  });

  async function handleCreateBug() {
    const value = form.state.values;
    const template = value.template || null;
    if (!canCreateBug(value.projectId, template)) {
      return;
    }

    const key = pendingBugKey.current ?? crypto.randomUUID();
    pendingBugKey.current = key;
    await createBug.mutateAsync(captureInput(value, key));
    form.reset();
  }

  function handleCreateBugClick() {
    handleCreateBug().catch(() => undefined);
  }

  function markDirty() {
    shell.markUnsavedChanges();
    setActionMessage(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <section
      aria-labelledby="new-capture-title"
      className="max-w-3xl space-y-6"
    >
      <div>
        <h2
          className="font-semibold text-xl tracking-tight"
          id="new-capture-title"
        >
          New capture
        </h2>
        <p className="mt-2 text-muted-foreground text-sm">
          The fields below are optional guidance; saving never creates a Work.
        </p>
      </div>

      {connection === "offline" ? (
        <p
          className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-destructive text-sm"
          role="status"
        >
          Disconnected. Capture writes need an active internet connection;
          nothing is queued locally.
        </p>
      ) : null}
      {actionMessage ? (
        <p className="border bg-muted/35 px-4 py-3 text-sm" role="status">
          {actionMessage}
        </p>
      ) : null}

      <form className="space-y-6" noValidate onSubmit={handleSubmit}>
        <FieldGroup>
          <form.Field name="content">
            {(field) => {
              function handleContentChange(
                event: ChangeEvent<HTMLTextAreaElement>,
              ) {
                field.handleChange(event.target.value);
                markDirty();
              }

              return (
                <Field>
                  <FieldLabel htmlFor="capture-content">Capture</FieldLabel>
                  <Textarea
                    className="min-h-32"
                    id="capture-content"
                    name={field.name}
                    onChange={handleContentChange}
                    placeholder="What do you want to remember?"
                    value={field.state.value}
                  />
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="projectId">
            {(field) => {
              function handleProjectChange(
                event: ChangeEvent<HTMLInputElement>,
              ) {
                field.handleChange(event.target.value);
                markDirty();
              }

              return (
                <Field>
                  <FieldLabel htmlFor="capture-project">Project</FieldLabel>
                  <Input
                    id="capture-project"
                    name={field.name}
                    onChange={handleProjectChange}
                    placeholder="Leave empty for Workspace"
                    value={field.state.value}
                  />
                  <FieldDescription>
                    Leave empty to save to the Workspace Capture Inbox.
                  </FieldDescription>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="template">
            {(field) => {
              const template = field.state.value || null;
              const labels = template
                ? CAPTURE_TEMPLATE_FIELD_LABELS[template]
                : [];

              function handleTemplateChange(
                event: ChangeEvent<HTMLSelectElement>,
              ) {
                const nextTemplate = event.target
                  .value as CaptureFormValues["template"];
                field.handleChange(nextTemplate);
                form.setFieldValue("fields", {});
                markDirty();
              }

              return (
                <Field>
                  <FieldLabel htmlFor="capture-template">
                    Mini template
                  </FieldLabel>
                  <NativeSelect
                    id="capture-template"
                    name={field.name}
                    onChange={handleTemplateChange}
                    value={field.state.value}
                  >
                    <NativeSelectOption value="">None</NativeSelectOption>
                    {CAPTURE_TEMPLATES.map((option) => (
                      <NativeSelectOption key={option} value={option}>
                        {option}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {labels.length > 0 ? (
                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                      {labels.map((label) => (
                        <form.Field key={label} name="fields">
                          {(fields) => {
                            function handleTemplateFieldChange(
                              event: ChangeEvent<HTMLTextAreaElement>,
                            ) {
                              fields.handleChange({
                                ...fields.state.value,
                                [label]: event.target.value,
                              });
                              markDirty();
                            }

                            return (
                              <Field>
                                <FieldLabel htmlFor={`capture-field-${label}`}>
                                  {label}
                                </FieldLabel>
                                <Textarea
                                  id={`capture-field-${label}`}
                                  onChange={handleTemplateFieldChange}
                                  value={fields.state.value[label] ?? ""}
                                />
                              </Field>
                            );
                          }}
                        </form.Field>
                      ))}
                    </div>
                  ) : null}
                </Field>
              );
            }}
          </form.Field>
        </FieldGroup>

        <div className="flex flex-wrap items-center gap-3 border-t pt-5">
          <Button
            disabled={connection === "offline" || createCapture.isPending}
            type="submit"
          >
            {createCapture.isPending ? "Saving…" : "Save"}
          </Button>
          <form.Subscribe selector={selectCreateBugValues}>
            {({ projectId, template }) => (
              <Button
                disabled={
                  connection === "offline" ||
                  createBug.isPending ||
                  !canCreateBug(projectId, template)
                }
                onClick={handleCreateBugClick}
                type="button"
                variant="outline"
              >
                {createBug.isPending ? "Creating…" : "Create Bug"}
              </Button>
            )}
          </form.Subscribe>
        </div>
        <p className="text-muted-foreground text-xs/relaxed">
          Create Bug is available when Project is set and type is Bug Capture.
        </p>
      </form>
    </section>
  );
}
