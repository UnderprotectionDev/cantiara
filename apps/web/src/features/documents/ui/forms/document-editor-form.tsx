// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  type Document,
  type DocumentEvidenceTargetType,
  documentTypeSchema,
} from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import {
  createDialogHandle,
  Dialog,
  DialogContent,
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
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCreateStore,
  useSelector as useStoreSelector,
} from "@tanstack/react-store";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Mathematics } from "@tiptap/extension-mathematics";
import { TableKit } from "@tiptap/extension-table";
import { Markdown as TiptapMarkdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import {
  type SetStateAction,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import ActiveWorkingSetControl from "@/components/active-working-set-control";
import FavoriteControl from "@/components/favorite-control";
import PersonalReminderControl from "@/components/personal-reminder-control";
import { defaultClientShell } from "@/features/web-macos-client/store/client-shell";
import { fetchFresh } from "@/lib/fetch-fresh";
import { submitForm } from "@/lib/submit-form";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
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
import DocumentWorkActionDialog, {
  type DocumentWorkAction,
} from "../components/document-work-action-dialog";
import DocumentBulkConversionDialog from "./document-bulk-conversion-form";
import DocumentDiagramConversionDialog from "./document-diagram-conversion-form";
import DocumentRecordConversionDialog from "./document-record-conversion-form";
import DocumentTransferForm from "./document-transfer-form";
import DocumentEvidenceDialog from "./document-version-evidence-form";

const lowlight = createLowlight(common);

interface DocumentEditorPresentation {
  conversionWarning: boolean;
  previewBody: string;
  selectedTextRange: { end: number; start: number } | null;
  selectedVersion: number | null;
  view: DocumentView;
}

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
  const { baseRevision: revision } = editing;
  const syncedRevision = useRef(revision);

  const initialPresentation: DocumentEditorPresentation = {
    view: targetSectionId ? "preview" : "write",
    conversionWarning: false,
    selectedVersion: null,
    previewBody: record.body,
    selectedTextRange: null,
  };
  const presentation = useCreateStore(initialPresentation, ({ setState }) => ({
    setView: (next: SetStateAction<DocumentView>) =>
      setState((state) => ({
        ...state,
        view: typeof next === "function" ? next(state.view) : next,
      })),
    setConversionWarning: (next: boolean) =>
      setState((state) => ({ ...state, conversionWarning: next })),
    setPreviewBody: (next: string) =>
      setState((state) => ({ ...state, previewBody: next })),
    setSelectedVersion: (next: number | null) =>
      setState((state) => ({ ...state, selectedVersion: next })),
    setSelectedTextRange: (
      next: DocumentEditorPresentation["selectedTextRange"],
    ) => setState((state) => ({ ...state, selectedTextRange: next })),
  }));
  const {
    view,
    conversionWarning,
    selectedVersion,
    previewBody,
    selectedTextRange,
  } = useStoreSelector(presentation);
  const {
    setView,
    setConversionWarning,
    setSelectedVersion,
    setPreviewBody,
    setSelectedTextRange,
  } = presentation.actions;

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
  const { savedBody } = editing;
  const insertForm = useForm({
    defaultValues: {
      selectedDiagramId: "",
      sectionDocumentId: "",
      sectionId: "",
      recordReferenceChoice: "",
      conversionTitle: record.title,
      originalBlockOutcome: "Keep independent" as
        | "Keep independent"
        | "Replace with live reference",
    },
  });
  const {
    selectedDiagramId,
    sectionDocumentId,
    sectionId,
    recordReferenceChoice,
    conversionTitle,
    originalBlockOutcome,
  } = useSelector(insertForm.store, (state) => state.values);
  const setSelectedDiagramId = (
    value: SetStateAction<typeof selectedDiagramId>,
  ) => insertForm.setFieldValue("selectedDiagramId", value);
  const setSectionDocumentId = (
    value: SetStateAction<typeof sectionDocumentId>,
  ) => insertForm.setFieldValue("sectionDocumentId", value);
  const setSectionId = (value: SetStateAction<typeof sectionId>) =>
    insertForm.setFieldValue("sectionId", value);
  const setRecordReferenceChoice = (
    value: SetStateAction<typeof recordReferenceChoice>,
  ) => insertForm.setFieldValue("recordReferenceChoice", value);
  const setConversionTitle = (value: SetStateAction<typeof conversionTitle>) =>
    insertForm.setFieldValue("conversionTitle", value);
  const setOriginalBlockOutcome = (
    value: SetStateAction<typeof originalBlockOutcome>,
  ) => insertForm.setFieldValue("originalBlockOutcome", value);
  const [pinEvidenceHandle] = useState(createDialogHandle);
  const [bulkConversionHandle] = useState(createDialogHandle);
  const [recordConversionHandle] = useState(createDialogHandle);
  const [diagramConversionHandle] = useState(
    createDialogHandle<{
      start: number;
      end: number;
      revision: number;
    }>,
  );
  useEffect(() => {
    if (targetSectionId) {
      setView("preview");
    }
  }, [setView, targetSectionId]);
  const conversionKey = useRef<string | null>(null);
  const pinEvidenceKey = useRef<string | null>(null);
  const recordConversionKey = useRef<string | null>(null);
  const recordConversionId = useRef<string | null>(null);
  const bulkConversionKey = useRef<string | null>(null);
  const [workActionHandle] = useState(createDialogHandle<DocumentWorkAction>);
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
  const diagramWrite = useMutation({
    mutationKey: orpc.convertMermaidToTechnicalDiagram.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: (
      input:
        | Parameters<typeof client.convertMermaidToTechnicalDiagram>[0]
        | Error,
    ) => {
      if (input instanceof Error) {
        throw input;
      }
      return client.convertMermaidToTechnicalDiagram(input);
    },
    onSuccess: async (_, input) => {
      if (input instanceof Error) {
        return;
      }
      if (conversionKey.current === input.clientIdempotencyKey) {
        if (input.originalBlock === "Replace with live reference") {
          const committed = await fetchFresh(queryClient, {
            ...orpc.document.queryOptions({
              input: { documentId: input.documentId },
            }),
          });
          if (conversionKey.current === input.clientIdempotencyKey) {
            editSession.accept(committed);
            form.setFieldValue("body", committed.body);
            setPreviewBody(committed.body);
          }
        }
        if (conversionKey.current === input.clientIdempotencyKey) {
          diagramConversionHandle.close();
          conversionKey.current = null;
        }
      }
      await queryClient.invalidateQueries({
        queryKey: orpc.technicalDiagrams.key(),
      });
    },
  });
  const convertedDiagram = diagramWrite.data ?? null;
  const works = useDocumentWorkSources(record, view);
  const bulkRows = documentListRows(savedBody);
  const recordReferenceOptions = documentRecordReferenceOptions(
    works.data,
    documentsForSections.data,
    sourceRecords.data,
    diagrams.data,
    record.id,
  );
  const allowRichUpdates = useRef(false);
  const save = useMutation({
    // Retry from the current editor so an old Support notice cannot save newer text.
    meta: { retryInSurface: true },
    mutationFn: () => editSession.save(),
    onSuccess: async () => {
      await Promise.all(invalidateSmartCollectionMembership(queryClient));
    },
    onError: (failure) =>
      form.setErrorMap({
        onSubmit: {
          form:
            failure instanceof Error
              ? failure.message
              : "Document could not be saved.",
          fields: {},
        },
      }),
  });
  const restore = usePreparedMutation(
    orpc.restoreDocumentVersion.mutationOptions({
      mutationFn: (input) => client.restoreDocumentVersion(input),
      onSuccess: async (restored) => {
        editSession.accept(restored);
        setSelectedVersion(null);
        form.setErrorMap({ onSubmit: undefined });
        await Promise.all(invalidateSmartCollectionMembership(queryClient));
        await onSaved();
      },
      onError: (failure) =>
        form.setErrorMap({
          onSubmit: {
            form:
              failure instanceof Error
                ? failure.message
                : "Document could not be restored.",
            fields: {},
          },
        }),
    }),
    (sourceRevision: number) => ({
      documentId: record.id,
      baseRevision: revision,
      revision: sourceRevision,
    }),
  );
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
        form.setErrorMap({
          onSubmit: {
            form:
              parsed.error.issues[0]?.message ?? "Document could not be saved.",
            fields: {},
          },
        });
        return;
      }
      await save.mutateAsync();
    },
  });
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
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
    syncedRevision.current = record.revision;
    // Move the form with the session now; otherwise its next change event
    // would write the previous body back into the accepted buffer.
    form.reset({ title: record.title, type: record.type, body: record.body });
  }, [editSession, editing.baseRevision, editing.dirty, form, record]);
  useEffect(() => {
    if (editing.dirty || revision === syncedRevision.current) {
      return;
    }
    syncedRevision.current = revision;
    form.setFieldValue("title", editing.buffer.title);
    form.setFieldValue("type", editing.buffer.type);
    form.setFieldValue("body", editing.buffer.body);
    bulkConversionKey.current = null;
    setSelectedTextRange(null);
    pinEvidenceKey.current = null;
    recordConversionKey.current = null;
    recordConversionId.current = null;
    form.setErrorMap({ onSubmit: undefined });
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
    setSelectedTextRange,
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
    syncedRevision.current = record.revision;
    form.setErrorMap({ onSubmit: undefined });
    setPreviewBody(record.body);
    form.reset({
      title: record.title,
      type: record.type,
      body: record.body,
    });
  }
  function acceptOrganizationResult(saved: Document) {
    const current = editSession.get();
    if (
      saved.id === record.id &&
      !current.dirty &&
      saved.revision > current.baseRevision
    ) {
      syncedRevision.current = saved.revision;
      editSession.accept(saved);
    }
  }
  const evidenceWrite = useMutation({
    mutationKey: orpc.pinDocumentEvidence.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: (
      input: Parameters<typeof client.pinDocumentEvidence>[0] | Error,
    ) => {
      if (input instanceof Error) {
        throw input;
      }
      return client.pinDocumentEvidence(input);
    },
    onSuccess: async (_, input) => {
      if (
        !(input instanceof Error) &&
        pinEvidenceKey.current === input.clientIdempotencyKey
      ) {
        pinEvidenceKey.current = null;
        pinEvidenceHandle.close();
      }
      await queryClient.invalidateQueries({ queryKey: orpc.usageLinks.key() });
    },
  });
  const pinEvidence = {
    ...evidenceWrite,
    mutateAsync(target: {
      targetRecordId: string;
      targetRecordType: DocumentEvidenceTargetType;
    }) {
      const selection = selectedTextRange;
      const body = form.getFieldValue("body");
      if (
        !selection ||
        selection.end <= selection.start ||
        target.targetRecordId.length === 0 ||
        body !== savedBody
      ) {
        return evidenceWrite.mutateAsync(
          new Error("Select saved Document text and an evidence target."),
        );
      }
      pinEvidenceKey.current ??= crypto.randomUUID();
      return evidenceWrite.mutateAsync({
        ...target,
        baseRevision: 0,
        clientIdempotencyKey: pinEvidenceKey.current,
        documentId: record.id,
        documentRevision: revision,
        selectionEnd: selection.end,
        selectionStart: selection.start,
        selectedText: body.slice(selection.start, selection.end),
      });
    },
  };
  const selectedTextWrite = useMutation({
    meta: { onlineWrite: true },
    mutationFn: async (
      input:
        | { kind: "Work"; command: Parameters<typeof client.createWork>[0] }
        | {
            kind: "Source";
            command: Parameters<typeof client.createProjectSourceRecord>[0];
          }
        | Error,
    ) => {
      if (input instanceof Error) {
        throw input;
      }
      if (input.kind === "Work") {
        await client.createWork(input.command);
        return;
      }
      await client.createProjectSourceRecord(input.command);
    },
    onSuccess: async (_, input) => {
      if (input instanceof Error) {
        return;
      }
      const { clientIdempotencyKey, projectId } = input.command;
      if (recordConversionKey.current === clientIdempotencyKey) {
        recordConversionHandle.close();
        recordConversionKey.current = null;
        recordConversionId.current = null;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.usageLinks.key() }),
        ...(input.kind === "Work"
          ? [
              queryClient.invalidateQueries({
                queryKey: orpc.projectWorks.queryKey({ input: { projectId } }),
              }),
              ...invalidateSmartCollectionMembership(queryClient),
            ]
          : [
              queryClient.invalidateQueries({
                queryKey: orpc.projectSourceRecords.queryKey({
                  input: { projectId },
                }),
              }),
            ]),
      ]);
    },
  });
  const convertSelectedText = {
    ...selectedTextWrite,
    mutateAsync(input: {
      recordType: DocumentConversionRecordType;
      title: string;
    }) {
      const { projectId } = record;
      const selection = selectedTextRange;
      const body = form.getFieldValue("body");
      if (
        !(projectId && selection) ||
        selection.end <= selection.start ||
        body !== savedBody ||
        !input.title.trim()
      ) {
        return selectedTextWrite.mutateAsync(
          new Error("Select saved Document text and review the record."),
        );
      }
      recordConversionKey.current ??= crypto.randomUUID();
      recordConversionId.current ??= crypto.randomUUID();
      const selectedText = body.slice(selection.start, selection.end);
      const command = {
        baseRevision: 0,
        clientIdempotencyKey: recordConversionKey.current,
        documentEvidence: {
          documentId: record.id,
          documentRevision: revision,
          selectionEnd: selection.end,
          selectionStart: selection.start,
          selectedText,
        },
        projectId,
        title: input.title,
      };
      if (input.recordType === "Work") {
        return selectedTextWrite.mutateAsync({
          kind: "Work",
          command: {
            ...command,
            description: selectedText,
            effort: null,
            plannedStartDate: null,
            targetDate: null,
            type: "Task",
          },
        });
      }
      const details = {
        Decision: {
          decision: selectedText,
          rationale: null,
          sourceType: "Decision",
        },
        Risk: {
          description: selectedText,
          impact: null,
          probability: null,
          response: null,
          sourceType: "Risk",
        },
        Assumption: {
          rationale: null,
          statement: selectedText,
          sourceType: "Assumption",
        },
        "Open Question": {
          context: null,
          question: selectedText,
          sourceType: "Open Question",
        },
      } as const;
      return selectedTextWrite.mutateAsync({
        kind: "Source",
        command: {
          ...command,
          ...details[input.recordType],
          id: recordConversionId.current,
        },
      });
    },
  };
  const listWrite = useMutation({
    mutationKey: orpc.createDocumentWorkBatch.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: (
      input: Parameters<typeof client.createDocumentWorkBatch>[0] | Error,
    ) => {
      if (input instanceof Error) {
        throw input;
      }
      return client.createDocumentWorkBatch(input);
    },
    onSuccess: async (_, input) => {
      if (input instanceof Error) {
        return;
      }
      if (bulkConversionKey.current === input.clientIdempotencyKey) {
        bulkConversionHandle.close();
        bulkConversionKey.current = null;
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.projectWorks.queryKey({
            input: { projectId: input.projectId },
          }),
        }),
        ...invalidateSmartCollectionMembership(queryClient),
        queryClient.invalidateQueries({ queryKey: orpc.usageLinks.key() }),
      ]);
    },
  });
  const convertListToWork = {
    ...listWrite,
    mutateAsync(selectedKeys: string[]) {
      const { projectId } = record;
      const body = form.getFieldValue("body");
      const selectedBulkRows = bulkRows.filter(({ start, end }) =>
        selectedKeys.includes(`${start}:${end}`),
      );
      if (!projectId || body !== savedBody || selectedBulkRows.length === 0) {
        return listWrite.mutateAsync(
          new Error("Save the Document and choose list rows first."),
        );
      }
      bulkConversionKey.current ??= crypto.randomUUID();
      return listWrite.mutateAsync({
        baseRevision: 0,
        clientIdempotencyKey: bulkConversionKey.current,
        documentId: record.id,
        documentRevision: revision,
        items: selectedBulkRows.map((row) => ({
          selectedText: body.slice(row.start, row.end),
          selectionEnd: row.end,
          selectionStart: row.start,
          title: titleFromSelectedText(row.text),
        })),
        projectId,
      });
    },
  };
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
  }, [editor, record.body, setConversionWarning, setView]);

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
    setConversionWarning,
    setView,
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
        setError={(message) =>
          form.setErrorMap({
            onSubmit: message ? { form: message, fields: {} } : undefined,
          })
        }
      />
      <DocumentConflictDrafts
        disabled={editing.offline || defaultClientShell.get().updateRequired}
        documentId={record.id}
        onResolved={(current) => {
          editSession.accept(current);
          form.setFieldValue("title", current.title);
          form.setFieldValue("type", current.type);
          form.setFieldValue("body", current.body);
          form.setErrorMap({ onSubmit: undefined });
          onSaved().catch(() => undefined);
        }}
        rejected={editing.conflictDraft}
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {record.projectId === null ? (
          <p className="w-fit rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            Personal Wiki
          </p>
        ) : null}
        <FavoriteControl
          sourceRecordId={record.id}
          sourceRecordType="Document"
        />
        <ActiveWorkingSetControl
          archived={Boolean(record.archivedAt)}
          member={{
            id: record.id,
            kind: "Document",
            label: record.title,
            projectId: record.projectId ?? null,
          }}
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
          submitForm(form).catch(() => undefined);
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
          <div className="flex flex-wrap items-end gap-4 border-b border-border pb-4">
            <form.Field name="title">
              {(field) => (
                <div className="min-w-60 flex-1">
                  <Label className="sr-only" htmlFor="document-title">
                    Title
                  </Label>
                  <Input
                    className="h-auto min-h-12 border-0 bg-transparent px-0 py-1 text-2xl font-semibold shadow-none dark:bg-transparent"
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
                    acceptOrganizationResult(saved);
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
                    acceptOrganizationResult(saved);
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
                      bulkConversionHandle={bulkConversionHandle}
                      bulkRows={bulkRows}
                      collectionViews={collectionViews}
                      diagrams={diagrams}
                      diagramVersions={diagramVersions}
                      diagramViews={diagramViews}
                      documentsForSections={documentsForSections}
                      field={field}
                      pinEvidenceHandle={pinEvidenceHandle}
                      pinEvidenceKey={pinEvidenceKey}
                      record={record}
                      recordConversionHandle={recordConversionHandle}
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
                      setConversionWarning={setConversionWarning}
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
                    openDiagramConversion={(range) =>
                      diagramConversionHandle.openWithPayload({
                        ...range,
                        revision,
                      })
                    }
                    openWorkAction={(action) =>
                      workActionHandle.openWithPayload(action)
                    }
                    previewBody={previewBody}
                    record={record}
                    savedBody={savedBody}
                    setConversionTitle={setConversionTitle}
                    setOriginalBlockOutcome={setOriginalBlockOutcome}
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
        recordConversionHandle={recordConversionHandle}
        recordConversionId={recordConversionId}
        recordConversionKey={recordConversionKey}
        revision={revision}
        selectedTextRange={selectedTextRange}
      />
      <DocumentBulkConversionDialog
        bulkConversionHandle={bulkConversionHandle}
        bulkConversionKey={bulkConversionKey}
        bulkRows={bulkRows}
        convertListToWork={convertListToWork}
        record={record}
        revision={revision}
      />
      <DocumentEvidenceDialog
        form={form}
        pinEvidence={pinEvidence}
        pinEvidenceHandle={pinEvidenceHandle}
        pinEvidenceKey={pinEvidenceKey}
        recordReferenceOptions={recordReferenceOptions}
        selectedTextRange={selectedTextRange}
      />
      <DocumentWorkActionDialog
        handle={workActionHandle}
        liveWorkOptions={liveWorkOptions}
        queryClient={queryClient}
      />
      <Dialog
        handle={diagramConversionHandle}
        onOpenChange={(open, event) => {
          if (
            !open &&
            diagramWrite.isPending &&
            event.reason !== "imperative-action"
          ) {
            event.cancel();
          }
        }}
      >
        {({ payload }) =>
          payload ? (
            <DialogContent>
              <DocumentDiagramConversion
                conversionKey={conversionKey}
                conversionSelection={payload}
                conversionTitle={conversionTitle}
                diagramWrite={diagramWrite}
                originalBlockOutcome={originalBlockOutcome}
                record={record}
                setConversionTitle={setConversionTitle}
                setOriginalBlockOutcome={setOriginalBlockOutcome}
              />
            </DialogContent>
          ) : null
        }
      </Dialog>
    </section>
  );
}

function DocumentDiagramConversion({
  conversionKey,
  conversionSelection,
  conversionTitle,
  diagramWrite,
  originalBlockOutcome,
  record,
  setConversionTitle,
  setOriginalBlockOutcome,
}: Omit<
  Parameters<typeof DocumentDiagramConversionDialog>[0],
  "conversionPreview" | "convertDiagram" | "conversionSelection"
> & {
  conversionSelection: { start: number; end: number; revision: number };
  diagramWrite: Pick<
    import("@tanstack/react-query").UseMutationResult<
      import("@cantiara/api/technical-diagrams").TechnicalDiagramSource,
      Error,
      Parameters<typeof client.convertMermaidToTechnicalDiagram>[0] | Error,
      unknown
    >,
    "mutateAsync" | "isPending" | "isError" | "error"
  >;
}) {
  const conversionPreview = useQuery({
    ...orpc.previewMermaidConversion.queryOptions({
      input: {
        documentId: record.id,
        documentRevision: conversionSelection.revision,
        blockStart: conversionSelection.start,
        blockEnd: conversionSelection.end,
        originalBlock: originalBlockOutcome,
        title: conversionTitle,
      },
    }),
  });
  const convertDiagram = {
    ...diagramWrite,
    mutateAsync() {
      const reviewed = conversionPreview.data;
      if (
        !(
          reviewed &&
          matchesDiagramConversionPreview(
            reviewed,
            conversionSelection,
            conversionTitle,
            originalBlockOutcome,
          )
        )
      ) {
        return diagramWrite.mutateAsync(
          new Error("Preview the Mermaid conversion again."),
        );
      }
      conversionKey.current ??= crypto.randomUUID();
      return diagramWrite.mutateAsync({
        documentId: record.id,
        documentRevision: conversionSelection.revision,
        blockStart: conversionSelection.start,
        blockEnd: conversionSelection.end,
        originalBlock: originalBlockOutcome,
        title: conversionTitle,
        previewToken: reviewed.previewToken,
        clientIdempotencyKey: conversionKey.current,
      });
    },
  };
  return (
    <DocumentDiagramConversionDialog
      conversionKey={conversionKey}
      conversionPreview={conversionPreview}
      conversionSelection={conversionSelection}
      conversionTitle={conversionTitle}
      convertDiagram={convertDiagram}
      originalBlockOutcome={originalBlockOutcome}
      record={record}
      setConversionTitle={setConversionTitle}
      setOriginalBlockOutcome={setOriginalBlockOutcome}
    />
  );
}
