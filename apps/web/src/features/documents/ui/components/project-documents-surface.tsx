// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import {
  type Document,
  type DocumentEvidenceTargetType,
  documentSections,
  documentTypeSchema,
} from "@cantiara/api/documents";
import type { StarterSkeletonSelection } from "@cantiara/api/project-shell";
import type { ProjectSourceRecord } from "@cantiara/api/project-source-records";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
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

import { documentRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import WorkStatusForm from "../../../work-lifecycle/ui/forms/work-status-form";
import DocumentFormattingToolbar from "./document-formatting-toolbar";
import DocumentPreview from "./document-preview";
import DocumentVersionCompare from "./document-version-compare";

const lowlight = createLowlight(common);
type DocumentView = "write" | "markdown" | "preview";
const markdownLineBreakPattern = /\r?\n/;
const markdownListItemPrefixPattern =
  /^(?:[-*+]\s+|\d+[.)]\s+)(?:\[[ xX]\]\s+)?/;
const markdownHeadingPrefixPattern = /^#{1,6}\s+/;
const markdownFenceOpeningPattern = /^ {0,3}(`{3,}|~{3,})/;
const markdownFenceClosingPattern = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const markdownListRowPattern =
  /^ {0,3}(?:[-+*]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?(.+?)[ \t]*$/;
const DOCUMENT_CONVERSION_CONTENT_FIELDS = {
  Work: "Description",
  Decision: "Decision text",
  Risk: "Description",
  Assumption: "Statement",
  "Open Question": "Question",
} as const;
type DocumentStarterSkeleton = Extract<
  StarterSkeletonSelection,
  { surface: "Document" }
>["skeleton"];
type DocumentCreateInput =
  | { skeleton: DocumentStarterSkeleton }
  | { title: string; type: Document["type"] };
type DocumentStarterSkeletonSelection = Extract<
  StarterSkeletonSelection,
  { surface: "Document" }
>;

interface DocumentSaveInput {
  body: string;
  title: string;
  type: Document["type"];
}

function comparableMarkdown(source: string) {
  return source.replaceAll("\r\n", "\n");
}

function titleFromSelectedText(source: string) {
  return (
    source
      .split(markdownLineBreakPattern)
      .map((line) =>
        line
          .trim()
          .replace(markdownListItemPrefixPattern, "")
          .replace(markdownHeadingPrefixPattern, ""),
      )
      .find(Boolean)
      ?.slice(0, 255) ?? "Extracted record"
  );
}

interface DocumentListRow {
  end: number;
  start: number;
  text: string;
}

function advanceMarkdownFence(
  line: string,
  fence: { marker: string; length: number } | null,
) {
  if (fence) {
    const [, closing] = markdownFenceClosingPattern.exec(line) ?? [];
    const closesFence =
      !!closing &&
      closing[0] === fence.marker &&
      closing.length >= fence.length;
    return { fence: closesFence ? null : fence, isFenceLine: true };
  }
  const [, opening] = markdownFenceOpeningPattern.exec(line) ?? [];
  if (opening) {
    return {
      fence: { marker: opening[0] ?? "", length: opening.length },
      isFenceLine: true,
    };
  }
  return { fence: null, isFenceLine: false };
}

function documentListRow(
  rawLine: string,
  offset: number,
): DocumentListRow | null {
  const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
  const match = markdownListRowPattern.exec(line);
  const [, text] = match ?? [];
  const [matchedText] = match ?? [];
  if (!(matchedText && text?.trim())) {
    return null;
  }
  const start = offset + matchedText.indexOf(text);
  return { end: start + text.length, start, text };
}

function documentListRows(source: string): DocumentListRow[] {
  const rows: DocumentListRow[] = [];
  let offset = 0;
  let fence: { marker: string; length: number } | null = null;
  for (const rawLine of source.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const { fence: nextFence, isFenceLine } = advanceMarkdownFence(line, fence);
    fence = nextFence;
    if (!isFenceLine) {
      const row = documentListRow(rawLine, offset);
      if (row) {
        rows.push(row);
      }
    }
    offset += rawLine.length + 1;
  }
  return rows;
}

function uniqueDocumentSections(source: string) {
  const sections = documentSections(source);
  const counts = new Map<string, number>();
  for (const section of sections) {
    counts.set(section.id, (counts.get(section.id) ?? 0) + 1);
  }
  return sections.filter(({ id }) => counts.get(id) === 1);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this editor coordinates one saved Document session across its dependent dialogs.
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
  const [pinEvidenceTargetType, setPinEvidenceTargetType] =
    useState<DocumentEvidenceTargetType>("Work");
  const [pinEvidenceTargetId, setPinEvidenceTargetId] = useState("");
  const [bulkConversionOpen, setBulkConversionOpen] = useState(false);
  const [bulkSelectionKeys, setBulkSelectionKeys] = useState<string[]>([]);
  const [recordConversionOpen, setRecordConversionOpen] = useState(false);
  const [recordConversionType, setRecordConversionType] = useState<
    "Work" | "Decision" | "Risk" | "Assumption" | "Open Question"
  >("Work");
  const [recordConversionTitle, setRecordConversionTitle] = useState("");
  const [conversionSelection, setConversionSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [conversionTitle, setConversionTitle] = useState(record.title);
  const [originalBlockOutcome, setOriginalBlockOutcome] = useState<
    "Keep independent" | "Replace with live reference"
  >("Keep independent");
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
  const collectionViews = useQuery({
    ...orpc.smartCollectionViews.queryOptions({
      input: { projectId: record.projectId },
    }),
    enabled: view === "markdown",
  });
  const documentsForSections = useQuery({
    ...orpc.documents.queryOptions({
      input: { projectId: record.projectId },
    }),
    enabled: view === "markdown",
  });
  const sourceRecords = useQuery({
    ...orpc.projectSourceRecords.queryOptions({
      input: { projectId: record.projectId },
    }),
    enabled: view === "markdown",
  });
  const sectionSourceDocument = documentsForSections.data?.find(
    ({ id }) => id === sectionDocumentId,
  );
  const availableSections = sectionSourceDocument
    ? uniqueDocumentSections(sectionSourceDocument.body)
    : [];
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
      conversionKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.convertMermaidToTechnicalDiagram({
          documentId: record.id,
          documentRevision: revision,
          blockStart: conversionSelection.start,
          blockEnd: conversionSelection.end,
          originalBlock: originalBlockOutcome,
          title: conversionTitle,
          clientIdempotencyKey: conversionKey.current as string,
        }),
      );
    },
    onSuccess: async (created) => {
      if (
        originalBlockOutcome === "Replace with live reference" &&
        conversionSelection
      ) {
        const body = form.getFieldValue("body");
        const reference = `:::live-diagram{diagramId="${created.id}"}`;
        const nextBody =
          body.slice(0, conversionSelection.start) +
          reference +
          body.slice(conversionSelection.end);
        form.setFieldValue("body", nextBody);
        setPreviewBody(nextBody);
        setSavedBody(nextBody);
        setRevision((current) => current + 1);
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
  const works = useQuery({
    ...orpc.projectWorks.queryOptions({
      input: { projectId: record.projectId },
    }),
    enabled: view === "markdown",
  });
  const bulkRows = documentListRows(savedBody);
  const selectedBulkRows = bulkRows.filter(({ start, end }) =>
    bulkSelectionKeys.includes(`${start}:${end}`),
  );
  const recordReferenceOptions = [
    ...(works.data ?? []).map((candidate) => ({
      id: candidate.id,
      label: `${candidate.key} · ${candidate.title}`,
      recordType: "Work",
    })),
    ...(documentsForSections.data ?? [])
      .filter(({ id }) => id !== record.id)
      .map((candidate) => ({
        id: candidate.id,
        label: candidate.title,
        recordType: "Document",
      })),
    ...(sourceRecords.data ?? []).map((candidate) => ({
      id: candidate.id,
      label: "name" in candidate ? candidate.name : candidate.title,
      recordType: candidate.sourceType,
    })),
    ...(diagrams.data ?? []).map((candidate) => ({
      id: candidate.id,
      label: candidate.title,
      recordType: "Technical Diagram",
    })),
  ];
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
      if (command.value.body !== savedBody) {
        setBulkSelectionKeys([]);
        bulkConversionKey.current = null;
        setSelectedTextRange(null);
      }
      pinEvidenceKey.current = null;
      recordConversionKey.current = null;
      recordConversionId.current = null;
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
  const pinEvidence = useMutation({
    mutationFn: () => {
      const selection = selectedTextRange;
      const body = form.getFieldValue("body");
      if (
        !selection ||
        selection.end <= selection.start ||
        pinEvidenceTargetId.length === 0 ||
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
          targetRecordId: pinEvidenceTargetId,
          targetRecordType: pinEvidenceTargetType,
        }),
      );
    },
    onSuccess: async () => {
      pinEvidenceKey.current = null;
      setPinEvidenceOpen(false);
      setPinEvidenceTargetId("");
      await queryClient.invalidateQueries({ queryKey: orpc.usageLinks.key() });
    },
  });
  const convertSelectedText = useMutation<
    WorkProfile | ProjectSourceRecord | null
  >({
    mutationFn: async () => {
      const selection = selectedTextRange;
      const body = form.getFieldValue("body");
      if (
        !selection ||
        selection.end <= selection.start ||
        body !== savedBody ||
        !recordConversionTitle.trim()
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
      if (recordConversionType === "Work") {
        return await runOnlineOnlyWrite(() =>
          client.createWork({
            baseRevision: 0,
            clientIdempotencyKey: recordConversionKey.current as string,
            description: documentEvidence.selectedText,
            documentEvidence,
            effort: null,
            plannedStartDate: null,
            projectId: record.projectId,
            targetDate: null,
            title: recordConversionTitle,
            type: "Task",
          }),
        );
      }
      const commonInput = {
        baseRevision: 0,
        clientIdempotencyKey: recordConversionKey.current as string,
        documentEvidence,
        id: recordConversionId.current as string,
        projectId: record.projectId,
        title: recordConversionTitle,
      };
      switch (recordConversionType) {
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
      await queryClient.invalidateQueries({
        queryKey: orpc.projectSourceRecords.key(),
      });
      await queryClient.invalidateQueries({ queryKey: orpc.usageLinks.key() });
    },
  });
  const convertListToWork = useMutation({
    mutationFn: () => {
      const body = form.getFieldValue("body");
      if (body !== savedBody || selectedBulkRows.length === 0) {
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
          projectId: record.projectId,
        }),
      );
    },
    onSuccess: async () => {
      setBulkConversionOpen(false);
      setBulkSelectionKeys([]);
      bulkConversionKey.current = null;
      await queryClient.invalidateQueries({
        queryKey: orpc.projectWorks.key(),
      });
      await queryClient.invalidateQueries({ queryKey: orpc.usageLinks.key() });
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
      // biome-ignore lint/suspicious/noUnnecessaryConditions: this mutable ref changes across editor write-mode transitions.
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
                      <Label htmlFor="document-live-work">
                        Live Work block
                      </Label>
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
                      <Label htmlFor="document-live-section-document">
                        Read-only live section
                      </Label>
                      <NativeSelect
                        id="document-live-section-document"
                        onChange={(event) => {
                          setSectionDocumentId(event.target.value);
                          setSectionId("");
                        }}
                        value={sectionDocumentId}
                      >
                        <NativeSelectOption value="">
                          Choose a Document
                        </NativeSelectOption>
                        {documentsForSections.data
                          ?.filter(({ id }) => id !== record.id)
                          .map((candidate) => (
                            <NativeSelectOption
                              key={candidate.id}
                              value={candidate.id}
                            >
                              {candidate.title}
                            </NativeSelectOption>
                          ))}
                      </NativeSelect>
                      <NativeSelect
                        aria-label="Document section"
                        disabled={!sectionSourceDocument}
                        onChange={(event) => setSectionId(event.target.value)}
                        value={sectionId}
                      >
                        <NativeSelectOption value="">
                          Choose a section
                        </NativeSelectOption>
                        {availableSections.map((section) => (
                          <NativeSelectOption
                            key={section.id}
                            value={section.id}
                          >
                            {section.heading}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <Button
                        disabled={!(sectionDocumentId && sectionId)}
                        onClick={() => {
                          const spacer = field.state.value.trimEnd()
                            ? "\n\n"
                            : "";
                          field.handleChange(
                            `${field.state.value.trimEnd()}${spacer}:::live-section{documentId="${sectionDocumentId}" sectionId="${sectionId}"}\n`,
                          );
                        }}
                        type="button"
                        variant="outline"
                      >
                        Insert Read-only live section
                      </Button>
                      <Label htmlFor="document-live-collection">
                        Named view
                      </Label>
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
                      <Label htmlFor="document-record-reference">
                        Record reference
                      </Label>
                      <NativeSelect
                        id="document-record-reference"
                        onChange={(event) =>
                          setRecordReferenceChoice(event.target.value)
                        }
                        value={recordReferenceChoice}
                      >
                        <NativeSelectOption value="">
                          Choose a record
                        </NativeSelectOption>
                        {recordReferenceOptions.map((candidate) => (
                          <NativeSelectOption
                            key={`${candidate.recordType}:${candidate.id}`}
                            value={`${candidate.recordType}:${candidate.id}`}
                          >
                            {candidate.recordType} · {candidate.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <Button
                        disabled={!recordReferenceChoice}
                        onClick={() => {
                          const reference = recordReferenceOptions.find(
                            ({ id, recordType }) =>
                              `${recordType}:${id}` === recordReferenceChoice,
                          );
                          if (!reference) {
                            return;
                          }
                          const label = reference.label
                            .replaceAll("|", " ")
                            .replaceAll("]", " ");
                          const token = `[[record:${reference.recordType}:${reference.id}|${label}]]`;
                          const spacer = field.state.value.trimEnd()
                            ? "\n\n"
                            : "";
                          field.handleChange(
                            `${field.state.value.trimEnd()}${spacer}${token}\n`,
                          );
                          setRecordReferenceChoice("");
                        }}
                        type="button"
                        variant="outline"
                      >
                        Insert record reference
                      </Button>
                      <Label htmlFor="document-markdown">Markdown source</Label>
                      <textarea
                        className="min-h-80 w-full resize-y rounded-lg border border-border bg-background p-5 font-mono text-sm leading-6 focus-visible:outline-2 focus-visible:outline-ring"
                        id="document-markdown"
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          setSelectedTextRange({
                            start: event.target.selectionStart,
                            end: event.target.selectionEnd,
                          });
                          setConversionWarning(false);
                        }}
                        onSelect={(event) => {
                          const nextSelection = {
                            start: event.currentTarget.selectionStart,
                            end: event.currentTarget.selectionEnd,
                          };
                          if (
                            nextSelection.start !== selectedTextRange?.start ||
                            nextSelection.end !== selectedTextRange?.end
                          ) {
                            pinEvidenceKey.current = null;
                          }
                          setSelectedTextRange(nextSelection);
                        }}
                        value={field.state.value}
                      />
                      <Button
                        disabled={
                          !selectedTextRange ||
                          selectedTextRange.end <= selectedTextRange.start ||
                          field.state.value !== savedBody
                        }
                        onClick={() => setPinEvidenceOpen(true)}
                        type="button"
                        variant="outline"
                      >
                        Version-pinned evidence
                      </Button>
                      <Button
                        disabled={
                          !selectedTextRange ||
                          selectedTextRange.end <= selectedTextRange.start ||
                          field.state.value !== savedBody
                        }
                        onClick={() => {
                          if (!selectedTextRange) {
                            return;
                          }
                          const selectedText = field.state.value.slice(
                            selectedTextRange.start,
                            selectedTextRange.end,
                          );
                          setRecordConversionTitle(
                            titleFromSelectedText(selectedText),
                          );
                          setRecordConversionType("Work");
                          recordConversionKey.current = null;
                          recordConversionId.current = null;
                          setRecordConversionOpen(true);
                        }}
                        type="button"
                        variant="outline"
                      >
                        Convert to record
                      </Button>
                      <Button
                        disabled={
                          bulkRows.length === 0 ||
                          field.state.value !== savedBody
                        }
                        onClick={() => {
                          setBulkConversionOpen(true);
                        }}
                        type="button"
                        variant="outline"
                      >
                        Convert in bulk
                      </Button>
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
                      documentReferences={
                        documentReferences.isPending
                          ? undefined
                          : (documentReferences.data ?? [])
                      }
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
                              setOriginalBlockOutcome("Keep independent");
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
      <Dialog
        onOpenChange={(open) => {
          setRecordConversionOpen(open);
          if (!open) {
            recordConversionKey.current = null;
            recordConversionId.current = null;
          }
        }}
        open={recordConversionOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to record</DialogTitle>
            <DialogDescription>
              Create one record with version-pinned evidence from the selected
              Document text.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="document-conversion-type">Record type</Label>
            <NativeSelect
              id="document-conversion-type"
              onChange={(event) => {
                setRecordConversionType(
                  event.target.value as
                    | "Work"
                    | "Decision"
                    | "Risk"
                    | "Assumption"
                    | "Open Question",
                );
                recordConversionKey.current = null;
                recordConversionId.current = null;
              }}
              value={recordConversionType}
            >
              <NativeSelectOption value="Work">Work</NativeSelectOption>
              <NativeSelectOption value="Decision">Decision</NativeSelectOption>
              <NativeSelectOption value="Risk">Risk</NativeSelectOption>
              <NativeSelectOption value="Assumption">
                Assumption
              </NativeSelectOption>
              <NativeSelectOption value="Open Question">
                Open Question
              </NativeSelectOption>
            </NativeSelect>
            <Label htmlFor="document-conversion-title">Title</Label>
            <Input
              id="document-conversion-title"
              onChange={(event) => {
                setRecordConversionTitle(event.target.value);
                recordConversionKey.current = null;
                recordConversionId.current = null;
              }}
              value={recordConversionTitle}
            />
            <div className="rounded-md border p-3 text-sm">
              <p>Project: {record.projectId}</p>
              <p>
                Document: {record.title} · Version {revision}
              </p>
              <p>Type: {recordConversionType}</p>
              <p>
                Content field:{" "}
                {DOCUMENT_CONVERSION_CONTENT_FIELDS[recordConversionType]}
              </p>
              <p>Evidence: selected text · version-pinned</p>
              <p className="mt-2 whitespace-pre-wrap">
                {selectedTextRange
                  ? form
                      .getFieldValue("body")
                      .slice(selectedTextRange.start, selectedTextRange.end)
                  : "No text selected."}
              </p>
            </div>
            {convertSelectedText.isError ? (
              <p role="alert">{convertSelectedText.error.message}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setRecordConversionOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={
                !recordConversionTitle.trim() || convertSelectedText.isPending
              }
              onClick={() => convertSelectedText.mutate()}
              type="button"
            >
              Convert to record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => {
          if (!open && convertListToWork.isPending) {
            return;
          }
          setBulkConversionOpen(open);
        }}
        open={bulkConversionOpen}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Convert in bulk</DialogTitle>
            <DialogDescription>
              Choose saved list rows to create as Work. All selected rows and
              their version-pinned evidence are committed together.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 text-sm">
            <p>Project: {record.projectId}</p>
            <p>
              Document: {record.title} · Version {revision}
            </p>
            <p>Record type: Task</p>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-3">
            {bulkRows.map((row) => {
              const key = `${row.start}:${row.end}`;
              const checked = bulkSelectionKeys.includes(key);
              return (
                <div
                  className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/50"
                  key={key}
                >
                  <Checkbox
                    aria-label={titleFromSelectedText(row.text)}
                    checked={checked}
                    disabled={convertListToWork.isPending}
                    onCheckedChange={(value) => {
                      setBulkSelectionKeys((current) =>
                        value === true
                          ? [...current, key]
                          : current.filter((candidate) => candidate !== key),
                      );
                      bulkConversionKey.current = null;
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {titleFromSelectedText(row.text)}
                    </span>
                    <span className="block whitespace-pre-wrap text-muted-foreground">
                      {row.text}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          {convertListToWork.isError ? (
            <p role="alert">{convertListToWork.error.message}</p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={convertListToWork.isPending}
              onClick={() => setBulkConversionOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={
                selectedBulkRows.length === 0 || convertListToWork.isPending
              }
              onClick={() => convertListToWork.mutate()}
              type="button"
            >
              Convert in bulk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(open) => {
          setPinEvidenceOpen(open);
        }}
        open={pinEvidenceOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Version-pinned evidence</DialogTitle>
            <DialogDescription>
              {selectedTextRange
                ? form
                    .getFieldValue("body")
                    .slice(selectedTextRange.start, selectedTextRange.end)
                : "Select text in the saved Document."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="document-evidence-target-type">Record type</Label>
            <NativeSelect
              id="document-evidence-target-type"
              onChange={(event) => {
                setPinEvidenceTargetType(
                  event.target.value as DocumentEvidenceTargetType,
                );
                setPinEvidenceTargetId("");
                pinEvidenceKey.current = null;
              }}
              value={pinEvidenceTargetType}
            >
              <NativeSelectOption value="Work">Work</NativeSelectOption>
              <NativeSelectOption value="Document">Document</NativeSelectOption>
              <NativeSelectOption value="Technical Diagram">
                Technical Diagram
              </NativeSelectOption>
              <NativeSelectOption value="Decision">Decision</NativeSelectOption>
              <NativeSelectOption value="Risk">Risk</NativeSelectOption>
              <NativeSelectOption value="Assumption">
                Assumption
              </NativeSelectOption>
              <NativeSelectOption value="Open Question">
                Open Question
              </NativeSelectOption>
              <NativeSelectOption value="Milestone">
                Milestone
              </NativeSelectOption>
              <NativeSelectOption value="Project Release">
                Project Release
              </NativeSelectOption>
              <NativeSelectOption value="Production Incident">
                Production Incident
              </NativeSelectOption>
            </NativeSelect>
            <Label htmlFor="document-evidence-target">Existing record</Label>
            <NativeSelect
              id="document-evidence-target"
              onChange={(event) => {
                setPinEvidenceTargetId(event.target.value);
                pinEvidenceKey.current = null;
              }}
              value={pinEvidenceTargetId}
            >
              <NativeSelectOption value="">Choose a record</NativeSelectOption>
              {recordReferenceOptions
                .filter(
                  (candidate) => candidate.recordType === pinEvidenceTargetType,
                )
                .map((candidate) => (
                  <NativeSelectOption key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
            {pinEvidence.isError ? (
              <p role="alert">{pinEvidence.error.message}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              onClick={() => setPinEvidenceOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!pinEvidenceTargetId || pinEvidence.isPending}
              onClick={() => pinEvidence.mutate()}
              type="button"
            >
              Version-pinned evidence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
            setOriginalBlockOutcome("Keep independent");
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
              onChange={(event) => {
                const nextTitle = event.target.value;
                if (nextTitle !== conversionTitle) {
                  conversionKey.current = null;
                }
                setConversionTitle(nextTitle);
              }}
              value={conversionTitle}
            />
            <Label htmlFor="converted-diagram-original-block">
              Original Mermaid block
            </Label>
            <NativeSelect
              id="converted-diagram-original-block"
              onChange={(event) => {
                conversionKey.current = null;
                setOriginalBlockOutcome(
                  event.target.value as
                    | "Keep independent"
                    | "Replace with live reference",
                );
              }}
              value={originalBlockOutcome}
            >
              <NativeSelectOption value="Keep independent">
                Keep independent
              </NativeSelectOption>
              <NativeSelectOption value="Replace with live reference">
                Replace with live reference
              </NativeSelectOption>
            </NativeSelect>
            {conversionPreview.data &&
            !conversionPreview.isFetching &&
            conversionPreview.data.title === conversionTitle &&
            conversionPreview.data.blockStart === conversionSelection?.start &&
            conversionPreview.data.blockEnd === conversionSelection.end &&
            conversionPreview.data.originalBlock === originalBlockOutcome ? (
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
                <p>
                  Original Mermaid block: {conversionPreview.data.originalBlock}
                </p>
                <p>
                  {conversionPreview.data.model.nodes.length} nodes ·{" "}
                  {conversionPreview.data.model.links.length} links
                </p>
                {conversionPreview.data.unparseableLines.length > 0 ? (
                  <div>
                    <p>Unparseable items</p>
                    <ul className="list-inside list-disc">
                      {conversionPreview.data.unparseableLines.map((line) => (
                        <li key={`${line.line}-${line.text}`}>
                          Line {line.line}: {line.text || line.reason} —{" "}
                          {line.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
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
                !conversionPreview.data?.canConvert ||
                conversionPreview.isFetching ||
                conversionPreview.data?.title !== conversionTitle ||
                conversionPreview.data?.originalBlock !==
                  originalBlockOutcome ||
                conversionPreview.data?.blockStart !==
                  conversionSelection?.start ||
                conversionPreview.data?.blockEnd !== conversionSelection.end ||
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
  selectedDocumentId,
  starterSkeletons,
}: {
  projectId: string;
  selectedDocumentId?: string;
  starterSkeletons: readonly StarterSkeletonSelection[];
}) {
  const queryClient = useQueryClient();
  const options = orpc.documents.queryOptions({ input: { projectId } });
  const documents = useQuery(options);
  const documentStarterSkeletons = starterSkeletons.filter(
    (selection): selection is DocumentStarterSkeletonSelection =>
      selection.surface === "Document",
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    selectedDocumentId ?? null,
  );
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
      ("skeleton" in value
        ? "skeleton" in pending.value &&
          pending.value.skeleton === value.skeleton
        : !("skeleton" in pending.value) &&
          pending.value.title === value.title &&
          pending.value.type === value.type)
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
      runOnlineOnlyWrite(() => {
        const mutationEnvelope = {
          projectId,
          baseRevision: 0,
          clientIdempotencyKey: command.clientIdempotencyKey,
        };
        if ("skeleton" in command.value) {
          return client.createDocument({
            ...mutationEnvelope,
            skeleton: command.value.skeleton,
          });
        }
        return client.createDocument({
          ...mutationEnvelope,
          ...command.value,
          body: "",
        });
      }),
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
    defaultValues: {
      skeleton: "" as "" | DocumentStarterSkeleton,
      title: "",
      type: "General" as Document["type"],
    },
    onSubmit: async ({ value }) => {
      const createValue = value.skeleton
        ? { skeleton: value.skeleton }
        : { title: value.title, type: value.type };
      await create.mutateAsync({
        clientIdempotencyKey: createIdempotencyKey(createValue),
        value: createValue,
      });
    },
  });
  const selected = documents.data?.find((item) => item.id === selectedId);

  useEffect(() => {
    if (
      selectedDocumentId &&
      documents.data?.some(({ id }) => id === selectedDocumentId)
    ) {
      setSelectedId(selectedDocumentId);
    }
  }, [documents.data, selectedDocumentId]);

  useEffect(() => {
    if (!selectedDocumentId || selectedId !== selectedDocumentId) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(documentRecordHash(selectedDocumentId))
        ?.scrollIntoView({ block: "start", behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedDocumentId, selectedId]);

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
              {documentStarterSkeletons.length > 0
                ? "Choose a starter skeleton, or give this Document a title and type."
                : "Give this Document a title and choose its type."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              form.handleSubmit().catch(() => undefined);
            }}
          >
            {documentStarterSkeletons.length > 0 ? (
              <form.Field name="skeleton">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="new-document-starter-skeleton">
                      Starter skeleton
                    </Label>
                    <NativeSelect
                      id="new-document-starter-skeleton"
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(
                          documentStarterSkeletons.find(
                            ({ skeleton }) => skeleton === event.target.value,
                          )?.skeleton ?? "",
                        )
                      }
                      value={field.state.value}
                    >
                      <NativeSelectOption value="">
                        No starter skeleton
                      </NativeSelectOption>
                      {documentStarterSkeletons.map(({ skeleton }) => (
                        <NativeSelectOption key={skeleton} value={skeleton}>
                          {skeleton}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                )}
              </form.Field>
            ) : null}
            <form.Subscribe selector={(state) => state.values.skeleton}>
              {(skeleton) =>
                skeleton ? null : (
                  <>
                    <form.Field name="title">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor="new-document-title">Title</Label>
                          <Input
                            autoFocus
                            id="new-document-title"
                            onBlur={field.handleBlur}
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
                  </>
                )
              }
            </form.Subscribe>
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
                  skeleton: state.values.skeleton,
                  title: state.values.title,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ skeleton, title, isSubmitting }) => (
                  <Button
                    disabled={isSubmitting || !(skeleton || title.trim())}
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
              id={documentRecordHash(item.id)}
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
