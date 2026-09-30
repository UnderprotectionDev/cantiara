// biome-ignore-all lint/performance/noJsxPropsBind: Template forms close over the selected scope and current field values.

import {
  type DocumentTemplate,
  documentTemplateFields,
  personalReviewTemplate,
} from "@cantiara/api/document-templates";
import { type Document, documentTypeSchema } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
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
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

type TemplateMode = "add" | "edit" | "convert" | "apply";
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
  const [mode, setMode] = useState<TemplateMode | null>(null);
  const [templateAtOpen, setTemplateAtOpen] = useState<TemplateChoice>();
  const [error, setError] = useState<string | null>(null);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [preview, setPreview] = useState<TemplateSourcePreview | null>(null);
  const pending = useRef<{ payload: string; key: string } | null>(null);

  const save = useMutation({
    mutationFn: (values: TemplateFormValues) =>
      runOnlineOnlyWrite(() => {
        const payload = JSON.stringify({
          mode,
          values,
          preview,
          templateId: templateAtOpen?.id,
          templateRevision:
            templateAtOpen && "revision" in templateAtOpen
              ? templateAtOpen.revision
              : undefined,
          projectId,
        });
        if (pending.current?.payload !== payload) {
          pending.current = { payload, key: crypto.randomUUID() };
        }
        const clientIdempotencyKey = pending.current.key;
        return submitTemplate({
          mode,
          values,
          selected: templateAtOpen,
          preview,
          projectId,
          clientIdempotencyKey,
        });
      }),
    onSuccess: async (result) => {
      if (result.document) {
        await onCreated(result.document);
      } else {
        setSelection(result.template.id);
        await queryClient.invalidateQueries({ queryKey: options.queryKey });
        setTemplateSaved(true);
      }
      pending.current = null;
      setMode(null);
      setTemplateAtOpen(undefined);
      setError(null);
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Document Template could not be saved.",
      ),
  });
  const form = useForm({
    defaultValues: {
      name: "",
      body: "",
      type: "General",
      title: "",
      values: {},
    } as TemplateFormValues,
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value);
    },
  });
  function open(nextMode: TemplateMode) {
    const openedTemplate = nextMode === "add" ? undefined : selected;
    pending.current = null;
    setTemplateAtOpen(openedTemplate);
    setError(null);
    setTemplateSaved(false);
    setPreview(null);
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
    setMode(nextMode);
  }
  const conversion = useMutation({
    mutationFn: () => {
      if (!source) {
        throw new Error("Select a Document.");
      }
      return client.previewDocumentTemplate({ documentId: source.id });
    },
    onSuccess: (result) => {
      open("convert");
      setPreview({
        sourceDocumentId: result.sourceDocumentId,
        sourceRevision: result.sourceRevision,
      });
      form.setFieldValue("name", result.name);
      form.setFieldValue("body", result.body);
      form.setFieldValue("type", result.type);
    },
    onError: () =>
      setError("Document could not be loaded for Convert to template."),
  });
  const title = templateDialogTitles[mode ?? "add"];
  let submitLabel = mode === "apply" ? "Create from template" : "Save";
  if (save.isPending) {
    submitLabel = "Saving…";
  }
  return (
    <section
      aria-label="Document Templates"
      className="space-y-3 rounded-lg border p-4"
    >
      <h3 className="font-medium">Document Templates</h3>
      <p className="text-muted-foreground text-sm">
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
              setTemplateSaved(false);
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
          disabled={!selected}
          onClick={() => open("apply")}
          type="button"
        >
          Create from template
        </Button>
        <Button
          disabled={!selected}
          onClick={() => open("edit")}
          type="button"
          variant="outline"
        >
          Edit Document Template
        </Button>
        <Button onClick={() => open("add")} type="button" variant="outline">
          Add Document Template
        </Button>
        {source ? (
          <Button
            disabled={conversion.isPending}
            onClick={() => conversion.mutate()}
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
      {error && mode === null ? <p role="alert">{error}</p> : null}
      {templateSaved && mode === null ? (
        <p className="text-muted-foreground text-sm" role="status">
          Document Template saved. Existing Documents are unchanged.
        </p>
      ) : null}
      <Dialog
        onOpenChange={(openState) => {
          if (!(openState || save.isPending)) {
            setMode(null);
            setTemplateAtOpen(undefined);
            pending.current = null;
            setError(null);
          }
        }}
        open={mode !== null}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-xl p-6 sm:max-w-2xl">
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
              form.handleSubmit().catch(() => undefined);
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
                {documentTemplateFields(selected?.body ?? "").map((name) => (
                  <form.Field key={name} name={`values.${name}`}>
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={`${identifier}-${name}`}>{name}</Label>
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
                ))}
                <Label htmlFor={`${identifier}-preview`}>Skeleton</Label>
                <textarea
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
                      <textarea
                        className="min-h-48 w-full rounded-lg border bg-background p-3 font-mono text-sm"
                        id={`${identifier}-body`}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        value={field.state.value}
                      />
                      <p className="text-muted-foreground text-sm">
                        Placeholders:{" "}
                        {documentTemplateFields(field.state.value).join(", ") ||
                          "None"}
                      </p>
                    </div>
                  )}
                </form.Field>
              </>
            )}
            {error ? <p role="alert">{error}</p> : null}
            <DialogFooter>
              <Button
                disabled={save.isPending}
                onClick={() => setMode(null)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
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
      </Dialog>
    </section>
  );
}
