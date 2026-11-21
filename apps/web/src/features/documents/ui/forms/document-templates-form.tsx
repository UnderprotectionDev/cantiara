// biome-ignore-all lint/performance/noJsxPropsBind: Template forms close over the selected scope and current field values.

import {
  type DocumentTemplate,
  documentTemplateFields,
  personalReviewTemplate,
} from "@cantiara/api/document-templates";
import { type Document, documentTypeSchema } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import {
  createDialogHandle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";

import { commandVariables } from "@/lib/command-variables";
import { client, orpc } from "@/utils/orpc";
import {
  createDocumentFromTemplateFormSchema,
  documentTemplateFormSchema,
} from "../../lib/document-template-form";

type TemplateMode = "add" | "edit" | "convert" | "apply";
interface TemplateDialogTarget {
  mode: TemplateMode;
  preview?: { sourceDocumentId: string; sourceRevision: number };
  template?: TemplateChoice;
}
const templateDialogTitles: Record<TemplateMode, string> = {
  add: "Add Document Template",
  edit: "Edit Document Template",
  convert: "Convert to template",
  apply: "Create from template",
};

function templateDialogDescription(
  mode: TemplateMode | null,
  isPrepared: boolean,
  sourceRevision?: number,
) {
  if (mode === "apply") {
    return "Create an independent Document from this skeleton.";
  }
  if (mode === "convert") {
    return `Preview the saved Document Version ${sourceRevision ?? ""}. Source links become plain text and live blocks are omitted. The source Document will not change.`;
  }
  if (mode === "edit" && isPrepared) {
    return "Save an editable copy of Personal Review in this scope.";
  }
  return "Save a reusable skeleton in this scope. Use {{field_name}} for simple text placeholders.";
}
interface TemplateFormValues {
  body: string;
  name: string;
  title: string;
  type: Document["type"];
  values: Record<string, string>;
}

type TemplateChoice = DocumentTemplate | typeof personalReviewTemplate;
interface TemplateSourcePreview {
  sourceDocumentId: string;
  sourceRevision: number;
}

async function submitTemplate(input: {
  mode: TemplateMode | null;
  values: TemplateFormValues;
  selected?: TemplateChoice;
  preview: TemplateSourcePreview | null;
  projectId: string | null;
  clientIdempotencyKey: string;
}) {
  const { mode, values, selected, preview, projectId, clientIdempotencyKey } =
    input;
  if (mode === "apply") {
    if (!selected) {
      throw new Error("Select a Document Template.");
    }
    const document = await client.createDocumentFromTemplate({
      projectId,
      templateId: selected.id,
      ...("revision" in selected
        ? { templateRevision: selected.revision }
        : {}),
      title: values.title,
      values: values.values,
      baseRevision: 0,
      clientIdempotencyKey,
    });
    return { document };
  }
  const definition = {
    name: values.name,
    body: values.body,
    type: values.type,
    clientIdempotencyKey,
  };
  if (mode === "edit" && selected && "revision" in selected) {
    return {
      template: await client.updateDocumentTemplate({
        ...definition,
        templateId: selected.id,
        baseRevision: selected.revision,
      }),
    };
  }
  return {
    template: await client.createDocumentTemplate({
      ...definition,
      projectId,
      baseRevision: 0,
      ...(mode === "convert" && preview ? preview : {}),
    }),
  };
}

export default function DocumentTemplatesSurface({
  projectId,
  source,
  onCreated,
}: {
  projectId: string | null;
  source?: Document | null;
  onCreated: (document: Document) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const identifier = useId();
  const options = orpc.documentTemplates.queryOptions({ input: { projectId } });
  const templates = useQuery(options);
  const [selection, setSelection] = useState<string>(personalReviewTemplate.id);
  const selected =
    selection === personalReviewTemplate.id
      ? personalReviewTemplate
      : templates.data?.find(({ id }) => id === selection);
  const [handle] = useState(createDialogHandle<TemplateDialogTarget>);
  const sourceControl = useRef<HTMLButtonElement | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const pending = useRef<{ key: string } | null>(null);

  const save = useMutation({
    meta: { onlineWrite: true },
    mutationFn: submitTemplate,
    onSuccess: async (result, input) => {
      if (result.document) {
        await onCreated(result.document);
      } else {
        await queryClient.invalidateQueries({
          queryKey: orpc.documentTemplates.queryKey({
            input: { projectId: input.projectId },
          }),
        });
        if (pending.current?.key === input.clientIdempotencyKey) {
          setSelection(result.template.id);
        }
      }
      if (pending.current?.key === input.clientIdempotencyKey) {
        pending.current = null;
        handle.close();
        setValidationError(null);
      }
    },
  });
  const form = useForm({
    defaultValues: {
      name: "",
      body: "",
      type: "General",
      title: "",
      values: {},
    } as TemplateFormValues,
    onSubmitMeta: undefined as TemplateDialogTarget | undefined,
    onSubmit: async ({ value, meta }) => {
      if (!meta) {
        return;
      }
      const { mode, template, preview } = meta;
      const parsed =
        mode === "apply"
          ? createDocumentFromTemplateFormSchema.safeParse(value)
          : documentTemplateFormSchema.safeParse(value);
      if (!parsed.success) {
        setValidationError(
          parsed.error.issues[0]?.message ??
            "Document Template could not be saved.",
        );
        return;
      }
      setValidationError(null);
      const input = commandVariables<
        Omit<Parameters<typeof submitTemplate>[0], "clientIdempotencyKey">
      >(
        {
          mode,
          values: { ...value, ...parsed.data },
          selected: template,
          preview: preview ?? null,
          projectId,
        },
        save.isError ? save.variables : undefined,
      );
      pending.current = { key: input.clientIdempotencyKey };
      await save.mutateAsync(input);
    },
  });
  function open(target: TemplateDialogTarget) {
    const { mode: nextMode, template: openedTemplate } = target;
    pending.current = null;
    save.reset();
    setValidationError(null);
    if (nextMode !== "convert") {
      conversion.reset();
    }
    let templateName = openedTemplate?.name ?? "";
    if (nextMode === "add") {
      templateName = "";
    } else if (
      nextMode === "edit" &&
      openedTemplate?.id === personalReviewTemplate.id
    ) {
      templateName = "Personal Review copy";
    }
    form.reset(
      {
        name: templateName,
        body: nextMode === "add" ? "" : (openedTemplate?.body ?? ""),
        type: openedTemplate?.type ?? "General",
        title: openedTemplate?.name ?? "",
        values: Object.fromEntries(
          documentTemplateFields(openedTemplate?.body ?? "").map((name) => [
            name,
            "",
          ]),
        ),
      },
      { keepDefaultValues: true },
    );
    handle.openWithPayload(target);
  }
  const conversion = useMutation({
    mutationKey: orpc.previewDocumentTemplate.mutationKey(),
    mutationFn: (documentId: string) =>
      client.previewDocumentTemplate({ documentId }),
    onSuccess: (result) => {
      open({
        mode: "convert",
        preview: {
          sourceDocumentId: result.sourceDocumentId,
          sourceRevision: result.sourceRevision,
        },
      });
      form.setFieldValue("name", result.name);
      form.setFieldValue("body", result.body);
      form.setFieldValue("type", result.type);
    },
  });
  const error =
    validationError ??
    save.error?.message ??
    (conversion.isError
      ? "Document could not be loaded for Convert to template."
      : null);
  const templateSaved = save.isSuccess && save.data.template;
  return (
    <section
      aria-label="Document Templates"
      className="space-y-3 rounded-lg border p-4"
    >
      <h3 className="font-medium">Document Templates</h3>
      <p className="text-sm text-muted-foreground">
        Templates are optional. Each Document has its own identity and never
        follows later template changes.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${identifier}-selection`}>Document Template</Label>
          <NativeSelect
            id={`${identifier}-selection`}
            onChange={(event) => {
              setSelection(event.target.value);
              save.reset();
            }}
            value={selection}
          >
            <NativeSelectOption value={personalReviewTemplate.id}>
              Personal Review
            </NativeSelectOption>
            {templates.data?.map((template) => (
              <NativeSelectOption key={template.id} value={template.id}>
                {template.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button
          disabled={!selected || conversion.isPending}
          onClick={(event) => {
            sourceControl.current = event.currentTarget;
            open({ mode: "apply", template: selected });
          }}
          type="button"
        >
          Create from template
        </Button>
        <Button
          disabled={!selected || conversion.isPending}
          onClick={(event) => {
            sourceControl.current = event.currentTarget;
            open({ mode: "edit", template: selected });
          }}
          type="button"
          variant="outline"
        >
          Edit Document Template
        </Button>
        <Button
          disabled={conversion.isPending}
          onClick={(event) => {
            sourceControl.current = event.currentTarget;
            open({ mode: "add" });
          }}
          type="button"
          variant="outline"
        >
          Add Document Template
        </Button>
        {source ? (
          <Button
            disabled={conversion.isPending}
            onClick={(event) => {
              sourceControl.current = event.currentTarget;
              conversion.mutate(source.id);
            }}
            type="button"
            variant="outline"
          >
            Convert to template
          </Button>
        ) : null}
      </div>
      {templates.isError ? (
        <p role="alert">Document Templates could not be loaded.</p>
      ) : null}
      {conversion.isError ? (
        <p role="alert">
          Document could not be loaded for Convert to template.
        </p>
      ) : null}
      {templateSaved ? (
        <p className="text-sm text-muted-foreground" role="status">
          Document Template saved. Existing Documents are unchanged.
        </p>
      ) : null}
      <Dialog
        handle={handle}
        onOpenChange={(openState, event) => {
          if (openState || event.reason === "imperative-action") {
            return;
          }
          if (save.isPending) {
            event.cancel();
            return;
          }
          pending.current = null;
        }}
      >
        {({ payload }) => {
          if (!payload) {
            return null;
          }
          const { mode, template: templateAtOpen, preview } = payload;
          const title = templateDialogTitles[mode];
          let submitLabel = mode === "apply" ? "Create from template" : "Save";
          if (save.isPending) {
            submitLabel = "Saving…";
          }
          return (
            <DialogContent
              className="max-h-[85vh] overflow-y-auto rounded-xl p-6 sm:max-w-2xl"
              finalFocus={sourceControl}
            >
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>
                  {templateDialogDescription(
                    mode,
                    templateAtOpen?.id === personalReviewTemplate.id,
                    preview?.sourceRevision,
                  )}
                </DialogDescription>
              </DialogHeader>
              <form
                aria-busy={save.isPending}
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  form.handleSubmit(payload).catch(() => undefined);
                }}
              >
                {mode === "apply" ? (
                  <>
                    <form.Field name="title">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor={`${identifier}-title`}>Title</Label>
                          <Input
                            autoFocus
                            id={`${identifier}-title`}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            required
                            value={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                    <p className="font-medium">Placeholders</p>
                    {documentTemplateFields(selected?.body ?? "").map(
                      (name) => (
                        <form.Field key={name} name={`values.${name}`}>
                          {(field) => (
                            <div className="space-y-2">
                              <Label htmlFor={`${identifier}-${name}`}>
                                {name}
                              </Label>
                              <Input
                                id={`${identifier}-${name}`}
                                onChange={(event) =>
                                  field.handleChange(event.target.value)
                                }
                                value={field.state.value ?? ""}
                              />
                            </div>
                          )}
                        </form.Field>
                      ),
                    )}
                    <Label htmlFor={`${identifier}-preview`}>Skeleton</Label>
                    <Textarea
                      className="min-h-48 w-full rounded-lg border bg-background p-3 font-mono text-sm"
                      id={`${identifier}-preview`}
                      readOnly
                      value={selected?.body ?? ""}
                    />
                  </>
                ) : (
                  <>
                    <form.Field name="name">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor={`${identifier}-name`}>Name</Label>
                          <Input
                            autoFocus
                            id={`${identifier}-name`}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            required
                            value={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                    <form.Field name="type">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor={`${identifier}-type`}>Type</Label>
                          <NativeSelect
                            id={`${identifier}-type`}
                            onChange={(event) =>
                              field.handleChange(
                                documentTypeSchema.parse(event.target.value),
                              )
                            }
                            value={field.state.value}
                          >
                            {documentTypeSchema.options.map((type) => (
                              <NativeSelectOption key={type} value={type}>
                                {type}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </div>
                      )}
                    </form.Field>
                    <form.Field name="body">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor={`${identifier}-body`}>Skeleton</Label>
                          <Textarea
                            className="min-h-48 w-full rounded-lg border bg-background p-3 font-mono text-sm"
                            id={`${identifier}-body`}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            value={field.state.value}
                          />
                          <p className="text-sm text-muted-foreground">
                            Placeholders:{" "}
                            {documentTemplateFields(field.state.value).join(
                              ", ",
                            ) || "None"}
                          </p>
                        </div>
                      )}
                    </form.Field>
                  </>
                )}
                {error ? <p role="alert">{error}</p> : null}
                <DialogFooter>
                  <DialogClose
                    disabled={save.isPending}
                    render={<Button variant="outline" />}
                  >
                    Cancel
                  </DialogClose>
                  <form.Subscribe
                    selector={(state) =>
                      mode === "apply" ? state.values.title : state.values.name
                    }
                  >
                    {(name) => (
                      <Button
                        disabled={save.isPending || !name.trim()}
                        type="submit"
                      >
                        {submitLabel}
                      </Button>
                    )}
                  </form.Subscribe>
                </DialogFooter>
              </form>
            </DialogContent>
          );
        }}
      </Dialog>
    </section>
  );
}
