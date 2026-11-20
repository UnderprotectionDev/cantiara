import {
  CAPTURE_TEMPLATE_FIELD_LABELS,
  CAPTURE_TEMPLATES,
  captureInputSchema,
} from "@cantiara/api/capture-triage";
import { Button } from "@cantiara/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@cantiara/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, type SubmitEvent, useRef } from "react";
import {
  useClientShell,
  useClientShellConnection,
} from "@/features/web-macos-client/hooks/use-client-shell";
import { submitForm } from "@/lib/submit-form";
import {
  captureInboxQueryOptions,
  client,
  projectsQueryOptions,
} from "@/utils/orpc";

import {
  type CaptureFormValues,
  CREATE_BUG_UNAVAILABLE_MESSAGE,
  captureDestination,
  captureFormValuesEqual,
  captureInput,
  captureProjectLabel,
} from "../../lib/capture-inbox";

const EMPTY_FORM_VALUES: CaptureFormValues = {
  content: "",
  fields: {},
  projectId: "",
  template: "",
};

function selectCaptureProjectId(state: { values: CaptureFormValues }) {
  return state.values.projectId;
}

function selectCaptureFormValues(state: { values: CaptureFormValues }) {
  return state.values;
}

function captureProjectDescription(projects: {
  isError: boolean;
  isPending: boolean;
}) {
  if (projects.isPending) {
    return "Loading Projects…";
  }
  if (projects.isError) {
    return "Projects could not be loaded. Try loading this page again.";
  }
  return "Leave empty to save to the Workspace Capture Inbox.";
}

export default function CaptureInboxForm({
  accountId,
  onSaved,
  showHeader = true,
}: {
  accountId: string;
  onSaved?: () => void;
  showHeader?: boolean;
}) {
  const queryClient = useQueryClient();
  const projects = useQuery(projectsQueryOptions());
  const shell = useClientShell();
  const connection = useClientShellConnection();
  const pendingCaptureKey = useRef<string | null>(null);
  const pendingBugKey = useRef<string | null>(null);

  const createCapture = useMutation({
    mutationFn: (input: ReturnType<typeof captureInput>) =>
      shell.runWrite(() => client.createCapture(input)),
    onSuccess: async () => {
      pendingCaptureKey.current = null;
      await queryClient.invalidateQueries({
        queryKey: captureInboxQueryOptions(accountId).queryKey,
      });
    },
  });

  const createBug = useMutation({
    mutationFn: (input: ReturnType<typeof captureInput>) =>
      shell.runWrite(() => client.createBug(input)),
    onSuccess: async () => {
      pendingBugKey.current = null;
      await queryClient.invalidateQueries({
        queryKey: captureInboxQueryOptions(accountId).queryKey,
      });
    },
  });

  const form = useForm({
    defaultValues: EMPTY_FORM_VALUES,
    onSubmitMeta: { action: "save" } as { action: "save" | "create-bug" },
    onSubmit: async ({ meta, formApi, value }) => {
      const bug = meta.action === "create-bug";
      const pendingKey = bug ? pendingBugKey : pendingCaptureKey;
      const writer = bug ? createBug : createCapture;
      const other = bug ? createCapture : createBug;
      other.reset();
      const key = pendingKey.current ?? crypto.randomUUID();
      pendingKey.current = key;
      const input = captureInput(value, key);
      const parsed = captureInputSchema.safeParse(input);
      if (!parsed.success) {
        writer.reset();
        formApi.setErrorMap({
          onSubmit: {
            form:
              parsed.error.issues[0]?.message ??
              (bug
                ? "Work could not be created from this Capture."
                : "Capture could not be saved."),
            fields: {},
          },
        });
        return;
      }
      await writer.mutateAsync(input);
      if (captureFormValuesEqual(value, formApi.state.values)) {
        formApi.reset();
        onSaved?.();
      } else {
        shell.markUnsavedChanges();
      }
    },
  });
  const validationError = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  let actionMessage = validationError;
  if (createCapture.isSuccess) {
    const destination = captureDestination(
      createCapture.variables?.projectId ?? "",
      projects.data ?? [],
    );
    actionMessage = `Capture saved. ${destination.detail}`;
  } else if (createCapture.isError) {
    actionMessage = "Capture could not be saved.";
  } else if (createBug.isSuccess) {
    actionMessage = `Work created (${createBug.data.workId}). It does not stay in the Capture Inbox.`;
  } else if (createBug.isError) {
    actionMessage =
      createBug.error instanceof Error
        ? createBug.error.message
        : "Work could not be created from this Capture.";
  }

  function markDirty() {
    if (!createCapture.isPending) {
      pendingCaptureKey.current = null;
      createCapture.reset();
    }
    if (!createBug.isPending) {
      pendingBugKey.current = null;
      createBug.reset();
    }
    shell.markUnsavedChanges();
    form.setErrorMap({ onSubmit: undefined });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }

  function handleCreateBug() {
    submitForm(form, { action: "create-bug" }).catch(() => undefined);
  }

  return (
    <section
      aria-label={showHeader ? undefined : "New capture form"}
      aria-labelledby={showHeader ? "new-capture-title" : undefined}
      className={
        showHeader
          ? "w-full space-y-6 border-y border-border/70 py-5"
          : "w-full space-y-6"
      }
    >
      {showHeader ? (
        <div>
          <h2
            className="text-xl font-semibold tracking-tight"
            id="new-capture-title"
          >
            New capture
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Save keeps a Capture in the Inbox; Create Bug creates a Bug Work
            directly when a Project is set.
          </p>
        </div>
      ) : null}

      {connection === "offline" ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="status"
        >
          Capture writes need an active internet connection; nothing is queued
          locally.
        </p>
      ) : null}
      {actionMessage ? (
        <p
          className="rounded-md border bg-muted/35 px-4 py-3 text-sm"
          role="status"
        >
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
                event: ChangeEvent<HTMLSelectElement>,
              ) {
                field.handleChange(event.target.value);
                markDirty();
              }

              return (
                <Field>
                  <FieldLabel htmlFor="capture-project">Project</FieldLabel>
                  <NativeSelect
                    className="w-full"
                    disabled={projects.status === "pending" || projects.isError}
                    id="capture-project"
                    name={field.name}
                    onChange={handleProjectChange}
                    value={field.state.value}
                  >
                    <NativeSelectOption value="">
                      Workspace Capture Inbox
                    </NativeSelectOption>
                    {projects.data?.map((project) => (
                      <NativeSelectOption key={project.id} value={project.id}>
                        {captureProjectLabel(project)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>
                    {captureProjectDescription(projects)}
                  </FieldDescription>
                </Field>
              );
            }}
          </form.Field>

          <form.Subscribe selector={selectCaptureProjectId}>
            {(projectId) => {
              const destination = captureDestination(
                projectId,
                projects.data ?? [],
              );

              return (
                <div
                  aria-live="polite"
                  className="rounded-md border border-primary/25 bg-primary/5 px-4 py-3"
                >
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <p className="mt-1 text-sm font-medium">
                    {destination.label}
                  </p>
                  <p className="mt-1 text-xs/relaxed text-muted-foreground">
                    {destination.detail}
                  </p>
                </div>
              );
            }}
          </form.Subscribe>

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

        <form.Subscribe selector={selectCaptureFormValues}>
          {(values) => {
            const projectIsSet = values.projectId.trim().length > 0;
            const supportedTemplate =
              values.template === "" || values.template === "Bug Capture";
            const canCreateBug =
              connection !== "offline" &&
              values.content.trim().length > 0 &&
              projectIsSet &&
              supportedTemplate;
            const writePending = createCapture.isPending || createBug.isPending;

            return (
              <div className="flex flex-wrap items-center gap-3 border-t pt-5">
                <Button
                  className="min-h-11"
                  disabled={connection === "offline" || writePending}
                  type="submit"
                >
                  {createCapture.isPending ? "Saving…" : "Save"}
                </Button>
                <Button
                  aria-describedby="create-bug-unavailable"
                  className="min-h-11"
                  disabled={!canCreateBug || writePending}
                  onClick={handleCreateBug}
                  type="button"
                  variant="outline"
                >
                  {createBug.isPending ? "Creating…" : "Create Bug"}
                </Button>
              </div>
            );
          }}
        </form.Subscribe>
        <p
          className="max-w-xl text-xs/relaxed text-muted-foreground"
          id="create-bug-unavailable"
        >
          {CREATE_BUG_UNAVAILABLE_MESSAGE}
        </p>
      </form>
    </section>
  );
}
