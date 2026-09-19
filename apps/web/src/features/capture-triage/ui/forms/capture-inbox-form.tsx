import {
  CAPTURE_TEMPLATE_FIELD_LABELS,
  CAPTURE_TEMPLATES,
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
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";

import {
  useClientShell,
  useClientShellConnection,
} from "@/features/web-macos-client/hooks/use-client-shell";
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
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const pendingCaptureKey = useRef<string | null>(null);
  const pendingBugKey = useRef<string | null>(null);

  const createCapture = useMutation({
    mutationFn: (input: ReturnType<typeof captureInput>) =>
      shell.runWrite(() => client.createCapture(input)),
    onError: () => setActionMessage("Capture could not be saved."),
    onSuccess: async (_data, variables) => {
      pendingCaptureKey.current = null;
      setActionMessage(
        `Capture saved. ${
          captureDestination(variables.projectId ?? "", projects.data ?? [])
            .detail
        }`,
      );
      await queryClient.invalidateQueries({
        queryKey: captureInboxQueryOptions(accountId).queryKey,
      });
    },
  });

  const createBug = useMutation({
    mutationFn: (input: ReturnType<typeof captureInput>) =>
      shell.runWrite(() => client.createBug(input)),
    onError: (error) => {
      setActionMessage(
        error instanceof Error
          ? error.message
          : "Work could not be created from this Capture.",
      );
    },
    onSuccess: async (receipt) => {
      pendingBugKey.current = null;
      setActionMessage(
        `Work created (${receipt.workId}). It does not stay in the Capture Inbox.`,
      );
      await queryClient.invalidateQueries({
        queryKey: captureInboxQueryOptions(accountId).queryKey,
      });
    },
  });

  const form = useForm({
    defaultValues: EMPTY_FORM_VALUES,
    onSubmit: async ({ value }) => {
      const key = pendingCaptureKey.current ?? crypto.randomUUID();
      pendingCaptureKey.current = key;
      await createCapture.mutateAsync(captureInput(value, key));
      if (captureFormValuesEqual(value, form.state.values)) {
        form.reset();
        onSaved?.();
      } else {
        shell.markUnsavedChanges();
      }
    },
  });

  function markDirty() {
    if (!createCapture.isPending) {
      pendingCaptureKey.current = null;
    }
    if (!createBug.isPending) {
      pendingBugKey.current = null;
    }
    shell.markUnsavedChanges();
    setActionMessage(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  function handleCreateBug() {
    const { values } = form.state;
    const key = pendingBugKey.current ?? crypto.randomUUID();
    pendingBugKey.current = key;
    createBug
      .mutateAsync(captureInput(values, key))
      .then(() => {
        if (captureFormValuesEqual(values, form.state.values)) {
          form.reset();
          onSaved?.();
        } else {
          shell.markUnsavedChanges();
        }
      })
      .catch(() => undefined);
  }

  return (
    <section
      aria-label={showHeader ? undefined : "New capture form"}
      aria-labelledby={showHeader ? "new-capture-title" : undefined}
      className={
        showHeader
          ? "w-full space-y-6 rounded-lg border border-border/70 bg-card/45 p-5 shadow-sm sm:p-6"
          : "w-full space-y-6"
      }
    >
      {showHeader ? (
        <div>
          <h2
            className="font-semibold text-xl tracking-tight"
            id="new-capture-title"
          >
            New capture
          </h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Save keeps a Capture in the Inbox; Create Bug creates a Bug Work
            directly when a Project is set.
          </p>
        </div>
      ) : null}

      {connection === "offline" ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-destructive text-sm"
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
                    disabled={projects.isPending || projects.isError}
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
                  <p className="text-muted-foreground text-xs">Destination</p>
                  <p className="mt-1 font-medium text-sm">
                    {destination.label}
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs/relaxed">
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
                  disabled={connection === "offline" || writePending}
                  type="submit"
                >
                  {createCapture.isPending ? "Saving…" : "Save"}
                </Button>
                <Button
                  aria-describedby="create-bug-unavailable"
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
          className="max-w-xl text-muted-foreground text-xs/relaxed"
          id="create-bug-unavailable"
        >
          {CREATE_BUG_UNAVAILABLE_MESSAGE}
        </p>
      </form>
    </section>
  );
}
