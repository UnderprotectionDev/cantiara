// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers and the transfer preview reset.
import {
  type DocumentTransferInput,
  type DocumentTransferPreview,
  documentTransferInputSchema,
  selectDocumentMove,
} from "@cantiara/api/document-transfer";
import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { documentExportFormSchema } from "../../lib/document-export-form";
import { DocumentTransferPreviewPanel } from "../components/document-transfer-preview";

type TransferAction = "Move" | "Copy" | "Export" | "Assign File Attachments";
type TransferFormat = "Markdown" | "PDF";

export default function DocumentTransferForm({
  record,
  documents,
  disabled,
  onCommitted,
}: {
  record: Document;
  documents: Document[];
  disabled: boolean;
  onCommitted: (record: Document) => Promise<void>;
}) {
  const [action, setAction] = useState<TransferAction | null>(null);
  const [preview, setPreview] = useState<DocumentTransferPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportPreview, setExportPreview] = useState<Awaited<
    ReturnType<typeof client.exportDocument>
  > | null>(null);
  const form = useForm({
    defaultValues: {
      attachmentIds: [] as string[],
      childDocumentIds: [] as string[],
      format: "Markdown" as TransferFormat,
      targetProjectId: "",
      version: record.revision,
    },
    onSubmit: async () => {
      await inspect.mutateAsync().catch(() => undefined);
    },
  });
  const pending = useRef<{ key: string; newDocumentId: string } | null>(null);
  const confirmed = useRef<
    Parameters<typeof client.transferDocument>[0] | null
  >(null);
  const projects = useQuery({
    ...orpc.projects.queryOptions(),
    enabled: action === "Move" || action === "Copy",
  });
  const versions = useQuery({
    ...orpc.documentVersions.queryOptions({ input: { documentId: record.id } }),
    enabled: action === "Copy" || action === "Export",
  });
  const attachments = useQuery({
    ...orpc.fileAttachments.queryOptions({
      input: { scope: { kind: "project", projectId: record.projectId ?? "" } },
    }),
    enabled: action === "Assign File Attachments" && !!record.projectId,
  });
  const childOptions =
    preview?.descendants ??
    documents.filter((item) => {
      if (item.id === record.id) {
        return false;
      }
      try {
        return selectDocumentMove(
          documents.map((candidate) => ({
            id: candidate.id,
            parentDocumentId: candidate.parentDocumentId ?? null,
          })),
          record.id,
          [item.id],
        ).includes(item.id);
      } catch {
        return false;
      }
    });
  function command(
    nextAction: DocumentTransferInput["action"],
  ): DocumentTransferInput {
    const { attachmentIds, childDocumentIds, targetProjectId, version } =
      form.state.values;
    pending.current ??= {
      key: crypto.randomUUID(),
      newDocumentId: crypto.randomUUID(),
    };
    return {
      action: nextAction,
      documentId: record.id,
      targetProjectId:
        nextAction === "Assign File Attachments"
          ? record.projectId
          : targetProjectId || null,
      childDocumentIds: nextAction === "Copy" ? [] : childDocumentIds,
      sourceRevision: nextAction === "Copy" ? version : record.revision,
      attachmentIds:
        nextAction === "Assign File Attachments" ? attachmentIds : [],
      ...(nextAction === "Copy"
        ? { newDocumentId: pending.current.newDocumentId }
        : {}),
    };
  }
  const inspect = useMutation({
    mutationFn: async () => {
      if (action === "Export") {
        const parsed = documentExportFormSchema.safeParse({
          documentId: record.id,
          format: form.state.values.format,
          revision: form.state.values.version,
        });
        if (!parsed.success) {
          throw new Error("Document export preview is unavailable.");
        }
        const snapshot = await client.exportDocument(parsed.data);
        setExportPreview(snapshot);
        return;
      }
      if (action) {
        const parsed = documentTransferInputSchema.safeParse(command(action));
        if (!parsed.success) {
          throw new Error(
            parsed.error.issues[0]?.message ??
              "Document transfer preview is unavailable.",
          );
        }
        const result = await client.previewDocumentTransfer(parsed.data);
        if (!("externalSurfaceIds" in result)) {
          throw new Error("Document transfer preview is unavailable.");
        }
        setPreview(result);
      }
    },
    onError: (failure) => setError(failure.message),
  });
  const apply = useMutation({
    mutationFn: async (nextAction: DocumentTransferInput["action"]) => {
      const selection = command(nextAction);
      let currentPreview = preview;
      if (nextAction === "Cancel External Surface") {
        pending.current = {
          key: crypto.randomUUID(),
          newDocumentId: crypto.randomUUID(),
        };
        const result = await client.previewDocumentTransfer(selection);
        if (!("externalSurfaceIds" in result)) {
          throw new Error("Document transfer preview is unavailable.");
        }
        currentPreview = result;
      }
      if (!(currentPreview && pending.current)) {
        throw new Error("Preview before Apply.");
      }
      confirmed.current ??= {
        ...selection,
        previewFingerprint: currentPreview.fingerprint,
        baseRevision: nextAction === "Copy" ? 0 : record.revision,
        clientIdempotencyKey: pending.current.key,
      };
      const confirmedInput = confirmed.current;
      return runOnlineOnlyWrite(() => client.transferDocument(confirmedInput));
    },
    onSuccess: async (saved, nextAction) => {
      await onCommitted(saved);
      setPreview(null);
      pending.current = null;
      confirmed.current = null;
      setError(null);
      if (nextAction !== "Cancel External Surface") {
        setAction(null);
      }
    },
    onError: (failure) => setError(failure.message),
  });
  const download = useMutation({
    mutationFn: () => {
      if (!exportPreview) {
        throw new Error("Preview before Download.");
      }
      return Promise.resolve(exportPreview);
    },
    onSuccess: (snapshot) => {
      const content =
        snapshot.format === "PDF"
          ? Uint8Array.from(atob(snapshot.content), (character) =>
              character.charCodeAt(0),
            )
          : snapshot.content;
      const url = URL.createObjectURL(
        new Blob([content], {
          type:
            snapshot.format === "PDF"
              ? "application/pdf"
              : "text/markdown;charset=utf-8",
        }),
      );
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${record.title.replace(/[^\p{L}\p{N}._-]+/gu, "-") || "document"}.${snapshot.format === "PDF" ? "pdf" : "md"}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setAction(null);
    },
    onError: (failure) => setError(failure.message),
  });
  function resetPreview() {
    confirmed.current = null;
    setPreview(null);
    setExportPreview(null);
    pending.current = null;
    setError(null);
  }
  function open(next: "Move" | "Copy" | "Export" | "Assign File Attachments") {
    resetPreview();
    form.setFieldValue("attachmentIds", []);
    form.setFieldValue("childDocumentIds", []);
    form.setFieldValue("targetProjectId", "");
    form.setFieldValue("version", record.revision);
    setAction(next);
  }
  const busy = apply.isPending || inspect.isPending || download.isPending;
  function handleMove() {
    open("Move");
  }
  function handleCopy() {
    open("Copy");
  }
  function handleExport() {
    open("Export");
  }
  function handleAttachments() {
    open("Assign File Attachments");
  }
  function handleOpenChange(isOpen: boolean) {
    if (!(isOpen || busy)) {
      setAction(null);
    }
  }
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  function handleCancelSurface() {
    apply.mutate("Cancel External Surface");
  }
  function handleDownload() {
    download.mutate();
  }
  function handleApply() {
    if (action && action !== "Export") {
      apply.mutate(action);
    }
  }
  function handleCancel() {
    setAction(null);
  }
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={disabled || !record.projectId}
          onClick={handleMove}
          type="button"
          variant="outline"
        >
          Move
        </Button>
        <Button
          disabled={disabled}
          onClick={handleCopy}
          type="button"
          variant="outline"
        >
          Copy
        </Button>
        <Button
          disabled={disabled}
          onClick={handleExport}
          type="button"
          variant="outline"
        >
          Export
        </Button>
        <Button
          disabled={disabled || !record.projectId}
          onClick={handleAttachments}
          type="button"
          variant="outline"
        >
          File Attachments
        </Button>
      </div>
      <Dialog onOpenChange={handleOpenChange} open={action !== null}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {action === "Assign File Attachments"
                ? action
                : `${action} Document`}
            </DialogTitle>
          </DialogHeader>
          <form className="contents" onSubmit={handleSubmit}>
            <form.Field name="targetProjectId">
              {(field) => (
                <TargetScopeField
                  action={action}
                  busy={busy}
                  onChange={(value) => {
                    field.handleChange(value);
                    resetPreview();
                  }}
                  projects={projects}
                  record={record}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <form.Field name="attachmentIds">
              {(field) => (
                <AttachmentsField
                  action={action}
                  attachments={attachments}
                  busy={busy}
                  onToggle={(id, checked) => {
                    field.handleChange(
                      checked
                        ? [...field.state.value, id]
                        : field.state.value.filter((value) => value !== id),
                    );
                    resetPreview();
                  }}
                  record={record}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <form.Field name="childDocumentIds">
              {(field) => (
                <ChildDocumentsField
                  action={action}
                  busy={busy}
                  childOptions={childOptions}
                  onToggle={(id, checked) => {
                    field.handleChange(
                      checked
                        ? [...field.state.value, id]
                        : field.state.value.filter((value) => value !== id),
                    );
                    resetPreview();
                  }}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <form.Field name="version">
              {(field) => (
                <VersionField
                  action={action}
                  busy={busy}
                  onChange={(value) => {
                    field.handleChange(value);
                    resetPreview();
                  }}
                  record={record}
                  value={field.state.value}
                  versions={versions}
                />
              )}
            </form.Field>
            <form.Field name="format">
              {(field) => (
                <FormatField
                  action={action}
                  busy={busy}
                  onChange={(value) => {
                    field.handleChange(value);
                    resetPreview();
                  }}
                  value={field.state.value}
                />
              )}
            </form.Field>
            {action === "Copy" ? (
              <p>
                Copy creates a new identity with source origin, without history,
                children, File Attachments, relations or publication.
              </p>
            ) : null}
            {preview ? (
              <DocumentTransferPreviewPanel preview={preview} />
            ) : null}
            {exportPreview ? (
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-sm">
                {exportPreview.markdown}
              </pre>
            ) : null}
            {error ? <p role="alert">{error}</p> : null}
            <DocumentTransferActions
              action={action}
              busy={busy}
              exportPreview={exportPreview}
              handleApply={handleApply}
              handleCancel={handleCancel}
              handleCancelSurface={handleCancelSurface}
              handleDownload={handleDownload}
              preview={preview}
            />
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DocumentTransferActions({
  busy,
  action,
  preview,
  handleCancelSurface,
  exportPreview,
  handleDownload,
  handleApply,
  handleCancel,
}: {
  busy: boolean;
  action: "Copy" | "Move" | "Assign File Attachments" | "Export" | null;
  preview: DocumentTransferPreview | null;
  handleCancelSurface: () => void;
  exportPreview: {
    format: "Markdown" | "PDF";
    content: string;
    capturedAt: string;
    documentId: string;
    markdown: string;
    revision: number;
    title: string;
  } | null;
  handleDownload: () => void;
  handleApply: () => void;
  handleCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} type="submit" variant="outline">
        Preview
      </Button>
      {action === "Move" && preview?.externalSurfaceIds.length ? (
        <Button
          disabled={busy}
          onClick={handleCancelSurface}
          type="button"
          variant="outline"
        >
          Cancel External Surface
        </Button>
      ) : null}
      {action === "Export" ? (
        <Button
          disabled={busy || !exportPreview}
          onClick={handleDownload}
          type="button"
        >
          Download
        </Button>
      ) : (
        <Button
          disabled={busy || !preview?.allowed}
          onClick={handleApply}
          type="button"
        >
          Apply
        </Button>
      )}
      <Button
        disabled={busy}
        onClick={handleCancel}
        type="button"
        variant="outline"
      >
        Cancel
      </Button>
    </div>
  );
}

function TargetScopeField({
  action,
  busy,
  onChange,
  projects,
  record,
  value,
}: {
  action: TransferAction | null;
  busy: boolean;
  onChange: (value: string) => void;
  projects: import("@tanstack/react-query").UseQueryResult<
    import("@cantiara/api/project-shell").ProjectProfile[],
    Error
  >;
  record: Document;
  value: string;
}) {
  if (action !== "Move" && action !== "Copy") {
    return null;
  }
  return (
    <div className="space-y-2">
      <Label htmlFor="document-target-scope">Target scope</Label>
      <NativeSelect
        disabled={busy}
        id="document-target-scope"
        name="targetProjectId"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <NativeSelectOption value="">Personal Wiki</NativeSelectOption>
        {projects.data
          ?.filter(
            (item) =>
              item.status === "Active" &&
              (action === "Copy" || item.id !== record.projectId),
          )
          .map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.name}
            </NativeSelectOption>
          ))}
      </NativeSelect>
    </div>
  );
}

function AttachmentsField({
  action,
  attachments,
  busy,
  onToggle,
  record,
  value,
}: {
  action: TransferAction | null;
  attachments: import("@tanstack/react-query").UseQueryResult<
    Awaited<ReturnType<typeof client.fileAttachments>>,
    Error
  >;
  busy: boolean;
  onToggle: (id: string, checked: boolean) => void;
  record: Document;
  value: string[];
}) {
  if (action !== "Assign File Attachments") {
    return null;
  }
  return (
    <fieldset className="space-y-2" disabled={busy}>
      <legend>File Attachments</legend>
      <p>
        Select File Attachments from this Project. Attachments already owned by
        another Document cannot be reassigned.
      </p>
      {attachments.data
        ?.filter(
          (item) => !item.ownerDocumentId || item.ownerDocumentId === record.id,
        )
        .map((item) => (
          <Label
            className="flex gap-2"
            htmlFor={`document-attachment-${item.id}`}
            key={item.id}
          >
            <Checkbox
              checked={value.includes(item.id)}
              id={`document-attachment-${item.id}`}
              onCheckedChange={(checked) => onToggle(item.id, checked === true)}
            />
            {item.name}
          </Label>
        ))}
    </fieldset>
  );
}

function ChildDocumentsField({
  action,
  busy,
  childOptions,
  onToggle,
  value,
}: {
  action: TransferAction | null;
  busy: boolean;
  childOptions: { id: string; title: string; revision: number }[];
  onToggle: (id: string, checked: boolean) => void;
  value: string[];
}) {
  if (action !== "Move") {
    return null;
  }
  return (
    <fieldset className="space-y-2" disabled={busy}>
      <legend>Child Documents</legend>
      {childOptions.map((item) => (
        <Label
          className="flex gap-2"
          htmlFor={`document-child-${item.id}`}
          key={item.id}
        >
          <Checkbox
            checked={value.includes(item.id)}
            id={`document-child-${item.id}`}
            onCheckedChange={(checked) => onToggle(item.id, checked === true)}
          />
          {item.title}
        </Label>
      ))}
    </fieldset>
  );
}

function VersionField({
  action,
  busy,
  onChange,
  record,
  value,
  versions,
}: {
  action: TransferAction | null;
  busy: boolean;
  onChange: (value: number) => void;
  record: Document;
  value: number;
  versions: import("@tanstack/react-query").UseQueryResult<
    { revision: number }[],
    Error
  >;
}) {
  if (action !== "Copy" && action !== "Export") {
    return null;
  }
  return (
    <div className="space-y-2">
      <Label htmlFor="document-transfer-version">Version</Label>
      <NativeSelect
        disabled={busy}
        id="document-transfer-version"
        name="version"
        onChange={(event) => onChange(Number(event.target.value))}
        value={String(value)}
      >
        {(versions.data ?? [{ revision: record.revision }]).map((item) => (
          <NativeSelectOption key={item.revision} value={String(item.revision)}>
            {item.revision}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

function FormatField({
  action,
  busy,
  onChange,
  value,
}: {
  action: TransferAction | null;
  busy: boolean;
  onChange: (value: TransferFormat) => void;
  value: TransferFormat;
}) {
  if (action !== "Export") {
    return null;
  }
  return (
    <div className="space-y-2">
      <Label htmlFor="document-export-format">Format</Label>
      <NativeSelect
        disabled={busy}
        id="document-export-format"
        name="format"
        onChange={(event) =>
          onChange(event.target.value === "PDF" ? "PDF" : "Markdown")
        }
        value={value}
      >
        <NativeSelectOption value="Markdown">Markdown</NativeSelectOption>
        <NativeSelectOption value="PDF">PDF</NativeSelectOption>
      </NativeSelect>
      <p>
        Live blocks become dated, read-only snapshots. No live external copy is
        created.
      </p>
      {value === "PDF" ? (
        <p>
          PDF export does not guarantee tagged PDF or WCAG compliance. Markdown
          is the accessible alternative.
        </p>
      ) : null}
    </div>
  );
}
