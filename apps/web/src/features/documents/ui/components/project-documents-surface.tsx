// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@cantiara/ui/components/tabs";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Mathematics } from "@tiptap/extension-mathematics";
import { TableKit } from "@tiptap/extension-table";
import { Markdown as TiptapMarkdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { useEffect, useRef, useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import DocumentFormattingToolbar from "./document-formatting-toolbar";
import DocumentPreview from "./document-preview";
import DocumentVersionCompare from "./document-version-compare";

const lowlight = createLowlight(common);
type DocumentView = "write" | "markdown" | "preview";
interface DocumentCreateInput {
  title: string;
  type: Document["type"];
}

interface DocumentSaveInput {
  body: string;
  title: string;
  type: Document["type"];
}

function comparableMarkdown(source: string) {
  return source.replaceAll("\r\n", "\n");
}

function DocumentEditor({
  record,
  onSaved,
}: {
  record: Document;
  onSaved: () => Promise<void>;
}) {
  const [revision, setRevision] = useState(record.revision);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<DocumentView>("write");
  const [conversionWarning, setConversionWarning] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const pendingRestore = useRef<{
    sourceRevision: number;
    baseRevision: number;
    clientIdempotencyKey: string;
  } | null>(null);
  const versionOptions = orpc.documentVersions.queryOptions({
    input: { documentId: record.id },
  });
  const versions = useQuery(versionOptions);
  const selectedVersionQuery = useQuery({
    ...orpc.documentVersion.queryOptions({
      input: {
        documentId: record.id,
        revision: selectedVersion ?? record.revision,
      },
    }),
    enabled: selectedVersion !== null && selectedVersion !== record.revision,
  });
  const selectedSnapshot =
    selectedVersion === record.revision ? record : selectedVersionQuery.data;
  const allowRichUpdates = useRef(false);
  const pendingSave = useRef<{
    baseRevision: number;
    clientIdempotencyKey: string;
    value: DocumentSaveInput;
  } | null>(null);

  function saveIdempotencyKey(value: DocumentSaveInput) {
    const pending = pendingSave.current;
    if (
      pending?.baseRevision === revision &&
      pending.value.title === value.title &&
      pending.value.type === value.type &&
      pending.value.body === value.body
    ) {
      return pending.clientIdempotencyKey;
    }
    const clientIdempotencyKey = crypto.randomUUID();
    pendingSave.current = {
      baseRevision: revision,
      clientIdempotencyKey,
      value: { ...value },
    };
    return clientIdempotencyKey;
  }

  const save = useMutation({
    mutationFn: (command: {
      clientIdempotencyKey: string;
      value: DocumentSaveInput;
    }) =>
      runOnlineOnlyWrite(() =>
        client.updateDocument({
          documentId: record.id,
          baseRevision: revision,
          clientIdempotencyKey: command.clientIdempotencyKey,
          ...command.value,
        }),
      ),
    onSuccess: async (saved, command) => {
      if (
        pendingSave.current?.clientIdempotencyKey ===
        command.clientIdempotencyKey
      ) {
        pendingSave.current = null;
      }
      setRevision(saved.revision);
      setError(null);
      await onSaved();
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Document could not be saved.",
      ),
  });
  const restore = useMutation({
    mutationFn: (sourceRevision: number) => {
      if (
        pendingRestore.current?.sourceRevision !== sourceRevision ||
        pendingRestore.current.baseRevision !== revision
      ) {
        pendingRestore.current = {
          sourceRevision,
          baseRevision: revision,
          clientIdempotencyKey: crypto.randomUUID(),
        };
      }
      const command = pendingRestore.current;
      return runOnlineOnlyWrite(() =>
        client.restoreDocumentVersion({
          documentId: record.id,
          revision: sourceRevision,
          baseRevision: command.baseRevision,
          clientIdempotencyKey: command.clientIdempotencyKey,
        }),
      );
    },
    onSuccess: async (restored) => {
      pendingRestore.current = null;
      setRevision(restored.revision);
      setSelectedVersion(null);
      setError(null);
      await onSaved();
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Document could not be restored.",
      ),
  });
  const form = useForm({
    defaultValues: {
      title: record.title,
      type: record.type,
      body: record.body,
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        clientIdempotencyKey: saveIdempotencyKey(value),
        value,
      });
    },
  });
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, underline: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Mathematics,
      TableKit,
      TiptapMarkdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: record.body,
    contentType: "markdown",
    editable: false,
    editorProps: {
      attributes: {
        "aria-label": "Document editor",
        class: "document-rich-editor",
      },
    },
    onUpdate: ({ editor: current }) => {
      // biome-ignore lint/suspicious/noUnnecessaryConditions: the ref changes when the user enters Write.
      if (allowRichUpdates.current) {
        form.setFieldValue("body", current.getMarkdown());
      }
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    if (save.isPending) {
      allowRichUpdates.current = false;
      editor.setEditable(false);
      return;
    }
    const safe =
      comparableMarkdown(editor.getMarkdown()) ===
      comparableMarkdown(record.body);
    if (safe) {
      editor.setEditable(true);
      allowRichUpdates.current = true;
    }
    if (!safe) {
      setView("markdown");
      setConversionWarning(true);
    }
  }, [editor, record.body, save.isPending]);

  function changeView(next: string) {
    if (next !== "write") {
      allowRichUpdates.current = false;
      setView(next as DocumentView);
      return;
    }
    if (!editor) {
      return;
    }
    const source = form.getFieldValue("body");
    try {
      const { markdown } = editor;
      if (!markdown) {
        throw new Error("Markdown conversion is unavailable.");
      }
      const parsed = markdown.parse(source);
      const converted = markdown.serialize(parsed);
      if (comparableMarkdown(converted) !== comparableMarkdown(source)) {
        setConversionWarning(true);
        setView("markdown");
        return;
      }
      editor.commands.setContent(source, {
        contentType: "markdown",
        emitUpdate: false,
      });
      editor.setEditable(true);
      allowRichUpdates.current = true;
      setConversionWarning(false);
      setView("write");
    } catch {
      setConversionWarning(true);
      setView("markdown");
    }
  }

  return (
    <section aria-label="Document">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit().catch(() => undefined);
        }}
      >
        <fieldset
          className="min-w-0 space-y-5 border-0 p-0"
          disabled={save.isPending}
        >
          <div className="flex flex-wrap items-end gap-4 border-border border-b pb-4">
            <form.Field name="title">
              {(field) => (
                <div className="min-w-60 flex-1">
                  <Label className="sr-only" htmlFor="document-title">
                    Title
                  </Label>
                  <Input
                    className="h-auto min-h-12 border-0 bg-transparent px-0 py-1 font-semibold text-2xl shadow-none dark:bg-transparent"
                    id="document-title"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="type">
              {(field) => (
                <div className="w-40 space-y-2">
                  <Label htmlFor="document-type">Type</Label>
                  <NativeSelect
                    id="document-type"
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(
                        documentTypeSchema.parse(event.target.value),
                      )
                    }
                    value={field.state.value}
                  >
                    {documentTypeSchema.options.map((option) => (
                      <NativeSelectOption key={option} value={option}>
                        {option}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </form.Field>
            <form.Subscribe
              selector={(state) => ({
                title: state.values.title,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ title, isSubmitting }) => (
                <Button disabled={isSubmitting || !title.trim()} type="submit">
                  Save
                </Button>
              )}
            </form.Subscribe>
          </div>
          <Tabs onValueChange={changeView} value={view}>
            <TabsList
              aria-label="Document view"
              className="mb-1"
              variant="line"
            >
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="markdown">Markdown</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent keepMounted value="write">
              <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
                {editor ? <DocumentFormattingToolbar editor={editor} /> : null}
                <EditorContent editor={editor} />
              </div>
            </TabsContent>
            <TabsContent keepMounted value="markdown">
              <div className="space-y-3">
                {conversionWarning ? (
                  <p
                    className="rounded-md border border-border bg-muted/50 p-3 text-sm"
                    role="alert"
                  >
                    This Markdown cannot be safely converted to Write. Continue
                    editing in Markdown, or use Preview; your source is
                    unchanged.
                  </p>
                ) : null}
                <form.Field name="body">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="document-markdown">Markdown source</Label>
                      <textarea
                        className="min-h-80 w-full resize-y rounded-lg border border-border bg-background p-5 font-mono text-sm leading-6 focus-visible:outline-2 focus-visible:outline-ring"
                        id="document-markdown"
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          setConversionWarning(false);
                        }}
                        value={field.state.value}
                      />
                    </div>
                  )}
                </form.Field>
              </div>
            </TabsContent>
            <TabsContent value="preview">
              <form.Subscribe selector={(state) => state.values.body}>
                {(body) => (
                  <div className="min-h-80 rounded-lg border border-border bg-background p-5 text-sm leading-7">
                    <DocumentPreview source={body} />
                  </div>
                )}
              </form.Subscribe>
            </TabsContent>
          </Tabs>
          <section
            aria-label="Versions"
            className="space-y-3 border-border border-t pt-5"
          >
            <h3 className="font-semibold">Versions</h3>
            {versions.isError || selectedVersionQuery.isError ? (
              <p role="alert">Versions could not be loaded.</p>
            ) : null}
            {selectedVersion !== null &&
            selectedVersion !== record.revision &&
            selectedVersionQuery.isPending ? (
              <p role="status">Loading…</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {versions.data?.map((version) => (
                <Button
                  aria-pressed={selectedVersion === version.revision}
                  key={version.revision}
                  onClick={() => setSelectedVersion(version.revision)}
                  type="button"
                  variant={
                    selectedVersion === version.revision
                      ? "secondary"
                      : "outline"
                  }
                >
                  Version {version.revision}
                </Button>
              ))}
            </div>
            {selectedSnapshot ? (
              <DocumentVersionCompare
                current={{ ...record, revision }}
                onRestore={() => restore.mutate(selectedSnapshot.revision)}
                pending={restore.isPending}
                selected={selectedSnapshot}
                unsavedChanges={form.state.isDirty}
              />
            ) : null}
          </section>
        </fieldset>
        {error ? (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}

export default function ProjectDocumentsSurface({
  projectId,
}: {
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const options = orpc.documents.queryOptions({ input: { projectId } });
  const documents = useQuery(options);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const pendingCreate = useRef<{
    clientIdempotencyKey: string;
    projectId: string;
    value: DocumentCreateInput;
  } | null>(null);

  function createIdempotencyKey(value: DocumentCreateInput) {
    const pending = pendingCreate.current;
    if (
      pending &&
      pending.projectId === projectId &&
      pending.value.title === value.title &&
      pending.value.type === value.type
    ) {
      return pending.clientIdempotencyKey;
    }
    const clientIdempotencyKey = crypto.randomUUID();
    pendingCreate.current = {
      clientIdempotencyKey,
      projectId,
      value: { ...value },
    };
    return clientIdempotencyKey;
  }

  const create = useMutation({
    mutationFn: (command: {
      clientIdempotencyKey: string;
      value: DocumentCreateInput;
    }) =>
      runOnlineOnlyWrite(() =>
        client.createDocument({
          projectId,
          baseRevision: 0,
          clientIdempotencyKey: command.clientIdempotencyKey,
          ...command.value,
          body: "",
        }),
      ),
    onSuccess: async (created, command) => {
      if (
        pendingCreate.current?.clientIdempotencyKey ===
        command.clientIdempotencyKey
      ) {
        pendingCreate.current = null;
      }
      setError(null);
      form.reset();
      setCreateOpen(false);
      setSelectedId(created.id);
      await queryClient.invalidateQueries({ queryKey: options.queryKey });
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Document could not be created.",
      ),
  });
  const form = useForm({
    defaultValues: { title: "", type: "General" as Document["type"] },
    onSubmit: async ({ value }) => {
      await create.mutateAsync({
        clientIdempotencyKey: createIdempotencyKey(value),
        value,
      });
    },
  });
  const selected = documents.data?.find((item) => item.id === selectedId);

  return (
    <section aria-label="Documents" className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-2xl">Documents</h2>
        <Button onClick={() => setCreateOpen(true)} type="button">
          Create Document
        </Button>
      </header>
      <Dialog
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            form.reset();
            setError(null);
          }
        }}
        open={createOpen}
      >
        <DialogContent className="rounded-xl p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Create Document</DialogTitle>
            <DialogDescription>
              Give this Document a title and choose its type.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              form.handleSubmit().catch(() => undefined);
            }}
          >
            <form.Field name="title">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="new-document-title">Title</Label>
                  <Input
                    autoFocus
                    id="new-document-title"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="type">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="new-document-type">Type</Label>
                  <NativeSelect
                    id="new-document-type"
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(
                        documentTypeSchema.parse(event.target.value),
                      )
                    }
                    value={field.state.value}
                  >
                    {documentTypeSchema.options.map((option) => (
                      <NativeSelectOption key={option} value={option}>
                        {option}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </form.Field>
            {error ? (
              <p className="text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                onClick={() => setCreateOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <form.Subscribe
                selector={(state) => ({
                  title: state.values.title,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ title, isSubmitting }) => (
                  <Button
                    disabled={isSubmitting || !title.trim()}
                    type="submit"
                  >
                    Create Document
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {documents.isError ? (
        <p role="alert">Documents could not be loaded.</p>
      ) : null}
      <div className="space-y-5">
        <nav aria-label="Documents" className="flex flex-wrap gap-2">
          {documents.data?.map((item) => (
            <Button
              className="max-w-full justify-start"
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              variant={item.id === selectedId ? "secondary" : "ghost"}
            >
              {item.title}
            </Button>
          ))}
        </nav>
        {selected ? (
          <DocumentEditor
            key={`${selected.id}-${selected.revision}`}
            onSaved={async () => {
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: options.queryKey }),
                queryClient.invalidateQueries({
                  queryKey: orpc.documentVersions.queryOptions({
                    input: { documentId: selected.id },
                  }).queryKey,
                }),
              ]);
            }}
            record={selected}
          />
        ) : (
          <p>Select a Document.</p>
        )}
      </div>
    </section>
  );
}
