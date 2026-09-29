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
import WorkStatusForm from "../../../work-lifecycle/ui/forms/work-status-form";
import DocumentFormattingToolbar from "./document-formatting-toolbar";
import DocumentPreview from "./document-preview";

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
  const queryClient = useQueryClient();
  const [revision, setRevision] = useState(record.revision);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<DocumentView>("write");
  const [conversionWarning, setConversionWarning] = useState(false);
  const [previewBody, setPreviewBody] = useState(record.body);
  const [savedBody, setSavedBody] = useState(record.body);
  const [selectedDiagramId, setSelectedDiagramId] = useState("");
  const [conversionSelection, setConversionSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [conversionTitle, setConversionTitle] = useState(record.title);
  const [convertedDiagram, setConvertedDiagram] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const conversionKey = useRef<string | null>(null);
  const [workAction, setWorkAction] = useState<{
    id: string;
    kind: "status" | "close";
    requestId: string;
  } | null>(null);
  const liveWorkOptions = orpc.documentLiveWorkBlocks.queryOptions({
    input: { documentId: record.id, body: previewBody },
  });
  const liveWorkBlocks = useQuery({
    ...liveWorkOptions,
    enabled: view === "preview",
  });
  const liveOtherOptions = orpc.documentLiveOtherBlocks.queryOptions({
    input: { documentId: record.id, body: previewBody },
  });
  const liveOtherBlocks = useQuery({
    ...liveOtherOptions,
    enabled: view === "preview",
  });
  const collectionViews = useQuery({
    ...orpc.smartCollectionViews.queryOptions({
      input: { projectId: record.projectId },
    }),
    enabled: view === "markdown",
  });
  const diagrams = useQuery({
    ...orpc.technicalDiagrams.queryOptions({
      input: { projectId: record.projectId },
    }),
    enabled: view === "markdown",
  });
  const diagramViews = useQuery({
    ...orpc.technicalDiagramViews.queryOptions({
      input: { diagramId: selectedDiagramId },
    }),
    enabled: view === "markdown" && selectedDiagramId.length > 0,
  });
  const conversionPreview = useQuery({
    ...orpc.previewMermaidConversion.queryOptions({
      input: {
        documentId: record.id,
        documentRevision: revision,
        blockStart: conversionSelection?.start ?? 0,
        blockEnd: conversionSelection?.end ?? 1,
        title: conversionTitle,
      },
    }),
    enabled: conversionSelection !== null,
  });
  const convertDiagram = useMutation({
    mutationFn: () => {
      if (!conversionSelection) {
        throw new Error("No Mermaid block selected.");
      }
      conversionKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.convertMermaidToTechnicalDiagram({
          documentId: record.id,
          documentRevision: revision,
          blockStart: conversionSelection.start,
          blockEnd: conversionSelection.end,
          title: conversionTitle,
          clientIdempotencyKey: conversionKey.current as string,
        }),
      );
    },
    onSuccess: async (created) => {
      setConversionSelection(null);
      conversionKey.current = null;
      if (created) {
        setConvertedDiagram({ id: created.id, title: created.title });
      }
      await queryClient.invalidateQueries({
        queryKey: orpc.technicalDiagrams.key(),
      });
    },
  });
  const works = useQuery({
    ...orpc.projectWorks.queryOptions({
      input: { projectId: record.projectId },
    }),
    enabled: view === "markdown",
  });
  const actionWork = useQuery({
    ...orpc.work.queryOptions({ input: { workId: workAction?.id ?? "" } }),
    enabled: workAction !== null,
    refetchOnMount: "always",
  });
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
      setSavedBody(command.value.body);
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: liveWorkOptions.queryKey,
      });
      await onSaved();
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Document could not be saved.",
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
      // biome-ignore lint/suspicious/noUnnecessaryConditions: Write mode changes this mutable ref after editor initialization.
      if (allowRichUpdates.current) {
        form.setFieldValue("body", current.getMarkdown());
      }
    },
  });

  useEffect(() => {
    if (!editor) {
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
      setView((current) => (current === "write" ? "markdown" : current));
      setConversionWarning(true);
    }
  }, [editor, record.body]);

  function changeView(next: string) {
    if (next !== "write") {
      allowRichUpdates.current = false;
      if (next === "preview") {
        setPreviewBody(form.getFieldValue("body"));
      }
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
        {convertedDiagram ? (
          <div
            className="rounded-md border border-border bg-muted/50 p-3 text-sm"
            role="status"
          >
            <p>Technical Diagram: {convertedDiagram.title}</p>
            <a
              className="underline"
              href={`/projects/${encodeURIComponent(record.projectId)}#technical-diagram-${encodeURIComponent(convertedDiagram.id)}`}
            >
              Open source record
            </a>
          </div>
        ) : null}
        <Tabs onValueChange={changeView} value={view}>
          <TabsList aria-label="Document view" className="mb-1" variant="line">
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
                  editing in Markdown, or use Preview; your source is unchanged.
                </p>
              ) : null}
              <form.Field name="body">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="document-live-work">Live Work block</Label>
                    <NativeSelect
                      id="document-live-work"
                      onChange={(event) => {
                        const workId = event.target.value;
                        if (!workId) {
                          return;
                        }
                        const spacer = field.state.value.trimEnd()
                          ? "\n\n"
                          : "";
                        field.handleChange(
                          `${field.state.value.trimEnd()}${spacer}:::live-work{workId="${workId}"}\n`,
                        );
                      }}
                      value=""
                    >
                      <NativeSelectOption value="">
                        Live Work block
                      </NativeSelectOption>
                      {works.data?.map((work) => (
                        <NativeSelectOption key={work.id} value={work.id}>
                          {work.key} · {work.title}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <Label htmlFor="document-live-collection">Named view</Label>
                    <NativeSelect
                      id="document-live-collection"
                      onChange={(event) => {
                        const viewId = event.target.value;
                        if (viewId) {
                          const spacer = field.state.value.trimEnd()
                            ? "\n\n"
                            : "";
                          field.handleChange(
                            `${field.state.value.trimEnd()}${spacer}:::live-collection{viewId="${viewId}"}\n`,
                          );
                        }
                      }}
                      value=""
                    >
                      <NativeSelectOption value="">
                        Named view
                      </NativeSelectOption>
                      {collectionViews.data?.map((source) => (
                        <NativeSelectOption key={source.id} value={source.id}>
                          {source.collectionName} · {source.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <a
                      className="text-sm underline"
                      href={`/projects/${record.projectId}#smart-collections`}
                    >
                      Smart Collection
                    </a>
                    <Label htmlFor="document-live-diagram">
                      Technical Diagram
                    </Label>
                    <NativeSelect
                      id="document-live-diagram"
                      onChange={(event) =>
                        setSelectedDiagramId(event.target.value)
                      }
                      value={selectedDiagramId}
                    >
                      <NativeSelectOption value="">
                        Technical Diagram
                      </NativeSelectOption>
                      {diagrams.data?.map((source) => (
                        <NativeSelectOption key={source.id} value={source.id}>
                          {source.title} · {source.type}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <a
                      className="text-sm underline"
                      href={`/projects/${encodeURIComponent(record.projectId)}#technical-diagrams`}
                    >
                      Technical Diagrams
                    </a>
                    {selectedDiagramId ? (
                      <>
                        <Label htmlFor="document-live-diagram-view">
                          Diagram View
                        </Label>
                        <NativeSelect
                          id="document-live-diagram-view"
                          onChange={(event) => {
                            const viewId = event.target.value;
                            if (viewId) {
                              const spacer = field.state.value.trimEnd()
                                ? "\n\n"
                                : "";
                              field.handleChange(
                                `${field.state.value.trimEnd()}${spacer}:::live-diagram{diagramId="${selectedDiagramId}" viewId="${viewId}"}\n`,
                              );
                            }
                          }}
                          value=""
                        >
                          <NativeSelectOption value="">
                            Diagram View
                          </NativeSelectOption>
                          {diagramViews.data?.map((diagramView) => (
                            <NativeSelectOption
                              key={diagramView.id}
                              value={diagramView.id}
                            >
                              {diagramView.name}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </>
                    ) : null}
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
                  <DocumentPreview
                    liveOtherBlocks={
                      liveOtherBlocks.isPending
                        ? undefined
                        : (liveOtherBlocks.data ?? [])
                    }
                    liveWorkBlocks={
                      liveWorkBlocks.isPending
                        ? undefined
                        : (liveWorkBlocks.data ?? [])
                    }
                    onLiveWorkAction={(id, kind) =>
                      setWorkAction({
                        id,
                        kind,
                        requestId: crypto.randomUUID(),
                      })
                    }
                    onMermaidConvert={
                      previewBody === savedBody
                        ? (start, end) => {
                            conversionKey.current = null;
                            setConversionTitle(record.title);
                            setConversionSelection({ start, end });
                          }
                        : undefined
                    }
                    source={body}
                  />
                </div>
              )}
            </form.Subscribe>
          </TabsContent>
        </Tabs>
        {error ? (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </form>
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setWorkAction(null);
            queryClient.invalidateQueries({
              queryKey: liveWorkOptions.queryKey,
            });
          }
        }}
        open={workAction !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {workAction?.kind === "close" ? "Close" : "Change status"}
            </DialogTitle>
            <DialogDescription>
              {actionWork.data?.key} · {actionWork.data?.title}
            </DialogDescription>
          </DialogHeader>
          {actionWork.data && !actionWork.isFetching && workAction ? (
            <WorkStatusForm
              completionFeedback={{
                effect: null,
                noticeVisible: false,
                reopenStatus: null,
              }}
              onCloseOutcome={() =>
                queryClient.invalidateQueries({
                  queryKey: liveWorkOptions.queryKey,
                })
              }
              onRequestedStatusActionHandled={() => undefined}
              requestedStatusAction={
                workAction.kind === "close"
                  ? { id: workAction.requestId, status: "Closed" }
                  : null
              }
              work={actionWork.data}
              workStatusLabels={[]}
            />
          ) : (
            <p role="status">Loading source record…</p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setConversionSelection(null);
            conversionKey.current = null;
          }
        }}
        open={conversionSelection !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Technical Diagram</DialogTitle>
            <DialogDescription>Imported Independent Copy</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="converted-diagram-title">Title</Label>
            <Input
              id="converted-diagram-title"
              onChange={(event) => setConversionTitle(event.target.value)}
              value={conversionTitle}
            />
            {conversionPreview.data &&
            !conversionPreview.isFetching &&
            conversionPreview.data.title === conversionTitle &&
            conversionPreview.data.blockStart === conversionSelection?.start &&
            conversionPreview.data.blockEnd === conversionSelection.end ? (
              <div className="text-sm">
                <p>
                  Document: {record.title} · Version:{" "}
                  {conversionPreview.data.documentRevision}
                </p>
                <p>Technical Architecture · Imported Independent Copy</p>
                <p>
                  Mermaid block: {conversionPreview.data.blockStart}–
                  {conversionPreview.data.blockEnd}
                </p>
                <p>Original Mermaid block stays independent.</p>
                <p>
                  {conversionPreview.data.model.nodes.length} nodes ·{" "}
                  {conversionPreview.data.model.links.length} links
                </p>
              </div>
            ) : null}
            {conversionPreview.isError ? (
              <p role="alert">{conversionPreview.error.message}</p>
            ) : null}
            {convertDiagram.isError ? (
              <p role="alert">{convertDiagram.error.message}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setConversionSelection(null)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={
                !conversionPreview.data ||
                conversionPreview.isFetching ||
                conversionPreview.data.title !== conversionTitle ||
                conversionPreview.data.blockStart !==
                  conversionSelection?.start ||
                conversionPreview.data.blockEnd !== conversionSelection.end ||
                convertDiagram.isPending
              }
              onClick={() => convertDiagram.mutate()}
              type="button"
            >
              Convert to Technical Diagram
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
            key={selected.id}
            onSaved={() =>
              queryClient.invalidateQueries({ queryKey: options.queryKey })
            }
            record={selected}
          />
        ) : (
          <p>Select a Document.</p>
        )}
      </div>
    </section>
  );
}
