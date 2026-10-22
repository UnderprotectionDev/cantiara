// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  type Document,
  type DocumentEvidenceTargetType,
  documentTypeSchema,
} from "@cantiara/api/documents";
import type { ProjectSourceRecord } from "@cantiara/api/project-source-records";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
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
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import FavoriteControl from "@/components/favorite-control";
import PersonalReminderControl from "@/components/personal-reminder-control";
import {
  defaultClientShell,
  runOnlineOnlyWrite,
} from "@/features/web-macos-client/store/client-shell";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";
import {
  useDocumentReferenceSources,
  useDocumentWorkSources,
} from "../../hooks/use-document-sources";
import type { DocumentConversionRecordType } from "../../lib/document-conversion-form";
import {
  comparableMarkdown,
  type DocumentView,
  documentListRows,
  documentRecordReferenceOptions,
  matchesDiagramConversionPreview,
  titleFromSelectedText,
  uniqueDocumentSections,
} from "../../lib/document-editor-markdown";
import { documentEditFormSchema } from "../../lib/document-form";
import { createDocumentEditSession } from "../../store/document-edit-session";
import DocumentBodyPreview from "../components/document-body-preview";
import DocumentConflictDrafts from "../components/document-conflict-drafts";
import {
  DocumentConvertedDiagramNotice,
  DocumentOriginNotice,
} from "../components/document-editor-notices";
import DocumentEvidenceControls from "../components/document-evidence-controls";
import DocumentFormattingToolbar from "../components/document-formatting-toolbar";
import DocumentInlineTags from "../components/document-inline-tags";
import DocumentMarkdownEditor from "../components/document-markdown-editor";
import DocumentOrganizationControls from "../components/document-organization-controls";
import DocumentRecoveryNotice from "../components/document-recovery-notice";
import DocumentVersionHistory from "../components/document-version-history";
import DocumentWorkActionDialog from "../components/document-work-action-dialog";
import DocumentBulkConversionDialog from "./document-bulk-conversion-form";
import DocumentDiagramConversionDialog from "./document-diagram-conversion-form";
import DocumentRecordConversionDialog from "./document-record-conversion-form";
import DocumentTransferForm from "./document-transfer-form";
import DocumentEvidenceDialog from "./document-version-evidence-form";

const lowlight = createLowlight(common);

export default function DocumentEditor({
  accountFormattingPreferences,
  record,
  onSaved,
  documents,
  targetSectionId,
}: {
  accountFormattingPreferences: AccountPreferences;
  record: Document;
  onSaved: () => Promise<void>;
  documents: Document[];
  targetSectionId?: string;
}) {
  const queryClient = useQueryClient();
  const originDocument = useQuery({
    ...orpc.document.queryOptions({
      input: { documentId: record.origin?.documentId ?? record.id },
    }),
    enabled: Boolean(record.origin),
  });
  const [editSession] = useState(() =>
    createDocumentEditSession({
      record,
      shell: defaultClientShell,
      write: (input) => client.updateDocument(input),
    }),
  );
  const editing = useSyncExternalStore(editSession.subscribe, editSession.get);
  const [revision, setRevision] = useState(record.revision);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<DocumentView>(() =>
    targetSectionId ? "preview" : "write",
  );
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
  const [previewBody, setPreviewBody] = useState(record.body);
  const [savedBody, setSavedBody] = useState(record.body);
  const [selectedDiagramId, setSelectedDiagramId] = useState("");
  const [sectionDocumentId, setSectionDocumentId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [recordReferenceChoice, setRecordReferenceChoice] = useState("");
  const [selectedTextRange, setSelectedTextRange] = useState<{
    end: number;
    start: number;
  } | null>(null);
  const [pinEvidenceOpen, setPinEvidenceOpen] = useState(false);
  const [bulkConversionOpen, setBulkConversionOpen] = useState(false);
  const [recordConversionOpen, setRecordConversionOpen] = useState(false);
  const [conversionSelection, setConversionSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [conversionTitle, setConversionTitle] = useState(record.title);
  const [originalBlockOutcome, setOriginalBlockOutcome] = useState<
    "Keep independent" | "Replace with live reference"
  >("Keep independent");
  useEffect(() => {
    if (targetSectionId) {
      setView("preview");
    }
  }, [targetSectionId]);
  const [convertedDiagram, setConvertedDiagram] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const conversionKey = useRef<string | null>(null);
  const pinEvidenceKey = useRef<string | null>(null);
  const recordConversionKey = useRef<string | null>(null);
  const recordConversionId = useRef<string | null>(null);
  const bulkConversionKey = useRef<string | null>(null);
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
  const documentReferences = useQuery({
    ...orpc.documentRecordReferences.queryOptions({
      input: { documentId: record.id, body: previewBody },
    }),
    enabled: view === "preview",
  });
  const {
    collectionViews,
    documentsForSections,
    sectionSourceDocument,
    availableSections,
    diagrams,
    diagramViews,
    diagramVersions,
    sourceRecords,
  } = useDocumentReferenceSources(
    record,
    view,
    sectionDocumentId,
    selectedDiagramId,
  );
  const conversionPreview = useQuery({
    ...orpc.previewMermaidConversion.queryOptions({
      input: {
        documentId: record.id,
        documentRevision: revision,
        blockStart: conversionSelection?.start ?? 0,
        blockEnd: conversionSelection?.end ?? 1,
        originalBlock: originalBlockOutcome,
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
      if (
        !matchesDiagramConversionPreview(
          conversionPreview.data,
          conversionSelection,
          conversionTitle,
          originalBlockOutcome,
        )
      ) {
        throw new Error("Preview the Mermaid conversion again.");
      }
      const previewToken = conversionPreview.data?.previewToken as string;
      conversionKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.convertMermaidToTechnicalDiagram({
          documentId: record.id,
          documentRevision: revision,
          blockStart: conversionSelection.start,
          blockEnd: conversionSelection.end,
          originalBlock: originalBlockOutcome,
          title: conversionTitle,
          previewToken,
          clientIdempotencyKey: conversionKey.current as string,
        }),
      );
    },
    onSuccess: async (created) => {
      if (
        originalBlockOutcome === "Replace with live reference" &&
        conversionSelection
      ) {
        const committed = await client.document({ documentId: record.id });
        editSession.accept(committed);
        form.setFieldValue("body", committed.body);
        setPreviewBody(committed.body);
      }
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
  const works = useDocumentWorkSources(record, view);
  const bulkRows = documentListRows(savedBody);
  const recordReferenceOptions = documentRecordReferenceOptions(
    works.data,
    documentsForSections.data,
    sourceRecords.data,
    diagrams.data,
    record.id,
  );
  const actionWork = useQuery({
    ...orpc.work.queryOptions({ input: { workId: workAction?.id ?? "" } }),
    enabled: workAction !== null,
    refetchOnMount: "always",
  });
  const allowRichUpdates = useRef(false);
  const save = useMutation({
    mutationFn: () => editSession.save(),
    onSuccess: async () => {
      await Promise.all(invalidateSmartCollectionMembership(queryClient));
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
      editSession.accept(restored);
      setSelectedVersion(null);
      setError(null);
      await Promise.all(invalidateSmartCollectionMembership(queryClient));
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
      editSession.edit(value);
      const parsed = documentEditFormSchema.safeParse(value);
      if (!parsed.success) {
        setError(
          parsed.error.issues[0]?.message ?? "Document could not be saved.",
        );
        return;
      }
      await save.mutateAsync();
    },
  });
  useEffect(() => editSession.connect(), [editSession]);
  useEffect(() => {
    const subscription = form.store.subscribe(() =>
      editSession.edit(form.state.values),
    );
    return () => subscription.unsubscribe();
  }, [editSession, form]);
  useEffect(() => {
    if (editing.dirty || record.revision <= editing.baseRevision) {
      return;
    }
    editSession.accept(record);
    // Move the form with the session now; otherwise its next change event
    // would write the previous body back into the accepted buffer.
    form.reset({ title: record.title, type: record.type, body: record.body });
    setRevision(record.revision);
  }, [editSession, editing.baseRevision, editing.dirty, form, record]);
  useEffect(() => {
    if (editing.dirty || editing.baseRevision === revision) {
      return;
    }
    setRevision(editing.baseRevision);
    setSavedBody(editing.buffer.body);
    form.setFieldValue("title", editing.buffer.title);
    form.setFieldValue("type", editing.buffer.type);
    form.setFieldValue("body", editing.buffer.body);
    bulkConversionKey.current = null;
    setSelectedTextRange(null);
    pinEvidenceKey.current = null;
    recordConversionKey.current = null;
    recordConversionId.current = null;
    setError(null);
    queryClient
      .invalidateQueries({ queryKey: liveWorkOptions.queryKey })
      .catch(() => undefined);
    queryClient
      .invalidateQueries({ queryKey: versionOptions.queryKey })
      .catch(() => undefined);
    onSaved().catch(() => undefined);
  }, [
    editing,
    form,
    revision,
    queryClient,
    liveWorkOptions.queryKey,
    versionOptions.queryKey,
    onSaved,
  ]);
  const hasNewerVersion = record.revision > revision;
  function reloadLatestVersion() {
    if (save.isPending) {
      return;
    }
    editSession.accept(record);
    setError(null);
    setRevision(record.revision);
    setPreviewBody(record.body);
    setSavedBody(record.body);
    form.reset({
      title: record.title,
      type: record.type,
      body: record.body,
    });
  }
  const pinEvidence = useMutation({
    mutationFn: (target: {
      targetRecordId: string;
      targetRecordType: DocumentEvidenceTargetType;
    }) => {
      const selection = selectedTextRange;
      const body = form.getFieldValue("body");
      if (
        !selection ||
        selection.end <= selection.start ||
        target.targetRecordId.length === 0 ||
        body !== savedBody
      ) {
        throw new Error("Select saved Document text and an evidence target.");
      }
      pinEvidenceKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.pinDocumentEvidence({
          baseRevision: 0,
          clientIdempotencyKey: pinEvidenceKey.current as string,
          documentId: record.id,
          documentRevision: revision,
          selectionEnd: selection.end,
          selectionStart: selection.start,
          selectedText: body.slice(selection.start, selection.end),
          targetRecordId: target.targetRecordId,
          targetRecordType: target.targetRecordType,
        }),
      );
    },
    onSuccess: async () => {
      pinEvidenceKey.current = null;
      setPinEvidenceOpen(false);
      await queryClient.invalidateQueries({ queryKey: orpc.usageLinks.key() });
    },
  });
  const convertSelectedText = useMutation<
    WorkProfile | ProjectSourceRecord | null,
    Error,
    { recordType: DocumentConversionRecordType; title: string }
  >({
    mutationFn: async (input: {
      recordType: DocumentConversionRecordType;
      title: string;
    }) => {
      const { projectId } = record;
      if (projectId === null) {
        throw new Error("A Project is required for record conversion.");
      }
      const selection = selectedTextRange;
      const body = form.getFieldValue("body");
      if (
        !selection ||
        selection.end <= selection.start ||
        body !== savedBody ||
        !input.title.trim()
      ) {
        throw new Error("Select saved Document text and review the record.");
      }
      recordConversionKey.current ??= crypto.randomUUID();
      recordConversionId.current ??= crypto.randomUUID();
      const documentEvidence = {
        documentId: record.id,
        documentRevision: revision,
        selectionEnd: selection.end,
        selectionStart: selection.start,
        selectedText: body.slice(selection.start, selection.end),
      };
      if (input.recordType === "Work") {
        return await runOnlineOnlyWrite(() =>
          client.createWork({
            baseRevision: 0,
            clientIdempotencyKey: recordConversionKey.current as string,
            description: documentEvidence.selectedText,
            documentEvidence,
            effort: null,
            plannedStartDate: null,
            projectId,
            targetDate: null,
            title: input.title,
            type: "Task",
          }),
        );
      }
      const commonInput = {
        baseRevision: 0,
        clientIdempotencyKey: recordConversionKey.current as string,
        documentEvidence,
        id: recordConversionId.current as string,
        projectId,
        title: input.title,
      };
      switch (input.recordType) {
        case "Decision":
          return await runOnlineOnlyWrite(() =>
            client.createProjectSourceRecord({
              ...commonInput,
              decision: documentEvidence.selectedText,
              rationale: null,
              sourceType: "Decision",
            }),
          );
        case "Risk":
          return await runOnlineOnlyWrite(() =>
            client.createProjectSourceRecord({
              ...commonInput,
              description: documentEvidence.selectedText,
              impact: null,
              probability: null,
              response: null,
              sourceType: "Risk",
            }),
          );
        case "Assumption":
          return await runOnlineOnlyWrite(() =>
            client.createProjectSourceRecord({
              ...commonInput,
              rationale: null,
              sourceType: "Assumption",
              statement: documentEvidence.selectedText,
            }),
          );
        case "Open Question":
          return await runOnlineOnlyWrite(() =>
            client.createProjectSourceRecord({
              ...commonInput,
              context: null,
              question: documentEvidence.selectedText,
              sourceType: "Open Question",
            }),
          );
        default:
          throw new Error("Unsupported Document record type.");
      }
    },
    onSuccess: async () => {
      setRecordConversionOpen(false);
      recordConversionKey.current = null;
      recordConversionId.current = null;
      await queryClient.invalidateQueries({
        queryKey: orpc.projectWorks.key(),
      });
      await Promise.all(invalidateSmartCollectionMembership(queryClient));
      await queryClient.invalidateQueries({
        queryKey: orpc.projectSourceRecords.key(),
      });
      await queryClient.invalidateQueries({ queryKey: orpc.usageLinks.key() });
    },
  });
  const convertListToWork = useMutation({
    mutationFn: (selectedKeys: string[]) => {
      const { projectId } = record;
      const body = form.getFieldValue("body");
      const selectedBulkRows = bulkRows.filter(({ start, end }) =>
        selectedKeys.includes(`${start}:${end}`),
      );
      if (
        projectId === null ||
        body !== savedBody ||
        selectedBulkRows.length === 0
      ) {
        throw new Error("Save the Document and choose list rows first.");
      }
      bulkConversionKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.createDocumentWorkBatch({
          baseRevision: 0,
          clientIdempotencyKey: bulkConversionKey.current as string,
          documentId: record.id,
          documentRevision: revision,
          items: selectedBulkRows.map((row) => ({
            selectedText: body.slice(row.start, row.end),
            selectionEnd: row.end,
            selectionStart: row.start,
            title: titleFromSelectedText(row.text),
          })),
          projectId,
        }),
      );
    },
    onSuccess: async () => {
      setBulkConversionOpen(false);
      bulkConversionKey.current = null;
      await queryClient.invalidateQueries({
        queryKey: orpc.projectWorks.key(),
      });
      await Promise.all(invalidateSmartCollectionMembership(queryClient));
      await queryClient.invalidateQueries({ queryKey: orpc.usageLinks.key() });
    },
  });
  function richUpdatesAllowed(): boolean {
    return allowRichUpdates.current;
  }

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
      if (
        richUpdatesAllowed() &&
        editSession.edit({ ...form.state.values, body: current.getMarkdown() })
      ) {
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
      allowRichUpdates.current = true;
    }
    if (!safe) {
      setView((current) => (current === "write" ? "markdown" : current));
      setConversionWarning(true);
    }
  }, [editor, record.body]);

  useEffect(() => {
    if (!editor || editing.dirty || editing.pending) {
      return;
    }
    allowRichUpdates.current = false;
    editor.commands.setContent(editing.buffer.body, {
      contentType: "markdown",
      emitUpdate: false,
    });
    const safe =
      comparableMarkdown(editor.getMarkdown()) ===
      comparableMarkdown(editing.buffer.body);
    if (!safe) {
      setView((current) => (current === "write" ? "markdown" : current));
      setConversionWarning(true);
    }
    allowRichUpdates.current = safe && editing.editable && view === "write";
  }, [
    editor,
    editing.buffer.body,
    editing.dirty,
    editing.pending,
    editing.editable,
    view,
  ]);

  useEffect(() => {
    editor?.setEditable(editing.editable && view === "write");
    allowRichUpdates.current = editing.editable && view === "write";
  }, [editor, editing.editable, view]);

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
      editor.setEditable(editing.editable);
      allowRichUpdates.current = editing.editable;
      setConversionWarning(false);
      setView("write");
    } catch {
      setConversionWarning(true);
      setView("markdown");
    }
  }

  const recoveryPayload = JSON.stringify(
    {
      title: editing.buffer.title,
      type: editing.buffer.type,
      body: editing.buffer.body,
    },
    null,
    2,
  );

  return (
    <section aria-label="Document">
      <DocumentOriginNotice originDocument={originDocument} record={record} />
      <DocumentRecoveryNotice
        accountFormattingPreferences={accountFormattingPreferences}
        editing={editing}
        recoveryPayload={recoveryPayload}
        setError={setError}
      />
      <DocumentConflictDrafts
        disabled={editing.offline || defaultClientShell.get().updateRequired}
        documentId={record.id}
        onResolved={(current) => {
          editSession.accept(current);
          form.setFieldValue("title", current.title);
          form.setFieldValue("type", current.type);
          form.setFieldValue("body", current.body);
          setError(null);
          onSaved().catch(() => undefined);
        }}
        rejected={editing.conflictDraft}
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {record.projectId === null ? (
          <p className="w-fit rounded-md bg-muted px-2 py-1 text-muted-foreground text-xs">
            Personal Wiki
          </p>
        ) : null}
        <FavoriteControl
          sourceRecordId={record.id}
          sourceRecordType="Document"
        />
        <PersonalReminderControl
          compact
          sectionOptions={uniqueDocumentSections(record.body)}
          sourceRecordId={record.id}
          sourceRecordType="Document"
          sourceTitle={record.title}
        />
      </div>
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit().catch(() => undefined);
        }}
      >
        {hasNewerVersion ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/50 p-3 text-sm">
            <p role="status">A newer Document version is available.</p>
            <Button
              disabled={save.isPending}
              onClick={reloadLatestVersion}
              type="button"
              variant="outline"
            >
              Reload latest version
            </Button>
          </div>
        ) : null}
        <fieldset
          className="min-w-0 space-y-5 border-0 p-0"
          disabled={!editing.editable}
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
                <Button
                  disabled={hasNewerVersion || isSubmitting || !title.trim()}
                  type="submit"
                >
                  Save
                </Button>
              )}
            </form.Subscribe>
          </div>
          <form.Subscribe selector={(state) => state.values}>
            {(values) => (
              <div className="space-y-3">
                <DocumentTransferForm
                  disabled={
                    hasNewerVersion ||
                    save.isPending ||
                    values.body !== savedBody ||
                    values.title !== record.title ||
                    values.type !== record.type
                  }
                  documents={documents}
                  onCommitted={async (saved) => {
                    if (saved.id === record.id) {
                      setRevision(saved.revision);
                    }
                    await queryClient.invalidateQueries({
                      queryKey: orpc.documentVersions.key(),
                    });
                    await queryClient.invalidateQueries({
                      queryKey: orpc.documents.key(),
                    });
                    await Promise.all(
                      invalidateSmartCollectionMembership(queryClient),
                    );
                    await onSaved();
                  }}
                  record={{ ...record, revision }}
                />
                <DocumentOrganizationControls
                  disabled={
                    hasNewerVersion ||
                    save.isPending ||
                    values.body !== savedBody ||
                    values.title !== record.title ||
                    values.type !== record.type
                  }
                  documents={documents}
                  onCommitted={async (saved) => {
                    setRevision(saved.revision);
                    await queryClient.invalidateQueries({
                      queryKey: versionOptions.queryKey,
                    });
                    await Promise.all(
                      invalidateSmartCollectionMembership(queryClient),
                    );
                    await onSaved();
                  }}
                  record={{ ...record, revision }}
                />
              </div>
            )}
          </form.Subscribe>
          {record.inlineTags?.length ? (
            <form.Subscribe selector={(state) => state.values.body}>
              {(body) => (
                <DocumentInlineTags
                  body={body}
                  onSelect={(tag) => {
                    setView("markdown");
                    window.requestAnimationFrame(() => {
                      const source =
                        document.getElementById("document-markdown");
                      if (source instanceof HTMLTextAreaElement) {
                        source.focus();
                        source.setSelectionRange(tag.start, tag.end);
                      }
                    });
                  }}
                  savedBody={savedBody}
                  tags={record.inlineTags ?? []}
                />
              )}
            </form.Subscribe>
          ) : null}
          <DocumentConvertedDiagramNotice
            convertedDiagram={convertedDiagram}
            record={record}
          />
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
                    <DocumentMarkdownEditor
                      availableSections={availableSections}
                      bulkRows={bulkRows}
                      collectionViews={collectionViews}
                      diagrams={diagrams}
                      diagramVersions={diagramVersions}
                      diagramViews={diagramViews}
                      documentsForSections={documentsForSections}
                      field={field}
                      pinEvidenceKey={pinEvidenceKey}
                      record={record}
                      recordConversionId={recordConversionId}
                      recordConversionKey={recordConversionKey}
                      recordReferenceChoice={recordReferenceChoice}
                      recordReferenceOptions={recordReferenceOptions}
                      savedBody={savedBody}
                      sectionDocumentId={sectionDocumentId}
                      sectionId={sectionId}
                      sectionSourceDocument={sectionSourceDocument}
                      selectedDiagramId={selectedDiagramId}
                      selectedTextRange={selectedTextRange}
                      setBulkConversionOpen={setBulkConversionOpen}
                      setConversionWarning={setConversionWarning}
                      setPinEvidenceOpen={setPinEvidenceOpen}
                      setRecordConversionOpen={setRecordConversionOpen}
                      setRecordReferenceChoice={setRecordReferenceChoice}
                      setSectionDocumentId={setSectionDocumentId}
                      setSectionId={setSectionId}
                      setSelectedDiagramId={setSelectedDiagramId}
                      setSelectedTextRange={setSelectedTextRange}
                      works={works}
                    />
                  )}
                </form.Field>
              </div>
            </TabsContent>
            <TabsContent value="preview">
              <form.Subscribe selector={(state) => state.values.body}>
                {(body) => (
                  <DocumentBodyPreview
                    body={body}
                    conversionKey={conversionKey}
                    documentReferences={documentReferences}
                    liveOtherBlocks={liveOtherBlocks}
                    liveWorkBlocks={liveWorkBlocks}
                    previewBody={previewBody}
                    record={record}
                    savedBody={savedBody}
                    setConversionSelection={setConversionSelection}
                    setConversionTitle={setConversionTitle}
                    setOriginalBlockOutcome={setOriginalBlockOutcome}
                    setWorkAction={setWorkAction}
                    targetSectionId={targetSectionId}
                  />
                )}
              </form.Subscribe>
            </TabsContent>
          </Tabs>
          <form.Subscribe selector={(state) => state.values.body}>
            {(body) => (
              <DocumentEvidenceControls
                canPin={body === savedBody}
                range={selectedTextRange}
                record={{ ...record, revision }}
              />
            )}
          </form.Subscribe>
          <DocumentVersionHistory
            form={form}
            record={record}
            restore={restore}
            revision={revision}
            selectedSnapshot={selectedSnapshot}
            selectedVersion={selectedVersion}
            selectedVersionQuery={selectedVersionQuery}
            setSelectedVersion={setSelectedVersion}
            versions={versions}
          />
        </fieldset>
        {error ? (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </form>
      <DocumentRecordConversionDialog
        convertSelectedText={convertSelectedText}
        form={form}
        record={record}
        recordConversionId={recordConversionId}
        recordConversionKey={recordConversionKey}
        recordConversionOpen={recordConversionOpen}
        revision={revision}
        selectedTextRange={selectedTextRange}
        setRecordConversionOpen={setRecordConversionOpen}
      />
      <DocumentBulkConversionDialog
        bulkConversionKey={bulkConversionKey}
        bulkConversionOpen={bulkConversionOpen}
        bulkRows={bulkRows}
        convertListToWork={convertListToWork}
        record={record}
        revision={revision}
        setBulkConversionOpen={setBulkConversionOpen}
      />
      <DocumentEvidenceDialog
        form={form}
        pinEvidence={pinEvidence}
        pinEvidenceKey={pinEvidenceKey}
        pinEvidenceOpen={pinEvidenceOpen}
        recordReferenceOptions={recordReferenceOptions}
        selectedTextRange={selectedTextRange}
        setPinEvidenceOpen={setPinEvidenceOpen}
      />
      <DocumentWorkActionDialog
        actionWork={actionWork}
        liveWorkOptions={liveWorkOptions}
        queryClient={queryClient}
        setWorkAction={setWorkAction}
        workAction={workAction}
      />
      <DocumentDiagramConversionDialog
        conversionKey={conversionKey}
        conversionPreview={conversionPreview}
        conversionSelection={conversionSelection}
        conversionTitle={conversionTitle}
        convertDiagram={convertDiagram}
        originalBlockOutcome={originalBlockOutcome}
        record={record}
        setConversionSelection={setConversionSelection}
        setConversionTitle={setConversionTitle}
        setOriginalBlockOutcome={setOriginalBlockOutcome}
      />
    </section>
  );
}
