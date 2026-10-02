import {
  type DocumentTransferInput,
  type DocumentTransferPreview,
  selectDocumentMove,
} from "@cantiara/api/document-transfer";
import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { type ChangeEvent, useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

export function DocumentTransferPreviewPanel({
  preview,
}: {
  preview: DocumentTransferPreview;
}) {
  return (
    <div aria-live="polite" className="space-y-2 rounded-md border p-3">
      <p>Target scope: {preview.targetLabel}</p>
      <p>Visibility remains account-only. No content becomes public.</p>
      <p>
        Unselected children remain in the source scope and lose a moved parent
        link.
      </p>
      <ul className="list-inside list-disc">
        {preview.documents.map((item) => (
          <li key={item.id}>
            {item.title} — Version {item.revision}
          </li>
        ))}
      </ul>
      <p>File Attachments</p>
      <ul className="list-inside list-disc">
        {preview.attachments.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
      <p>Broken references: {preview.brokenReferences.length}</p>
      <ul>
        {[
          ...new Map(
            preview.brokenReferences.map((item) => [
              `${item.recordId}:${item.label}`,
              item,
            ]),
          ).values(),
        ].map((item) => (
          <li key={`${item.recordId}:${item.label}`}>{item.label}</li>
        ))}
      </ul>
      <p>
        External Surfaces requiring cancellation:{" "}
        {preview.externalSurfaceIds.length}. Cancelled surfaces and snapshots
        stay in their original scope.
      </p>
      {preview.reason ? <p role="alert">{preview.reason}</p> : null}
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the dialog coordinates mutually exclusive Move, Copy, attachment ownership and export states.
export default function DocumentTransferControls({
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
  const [action, setAction] = useState<
    "Move" | "Copy" | "Export" | "Assign File Attachments" | null
  >(null);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [targetProjectId, setTargetProjectId] = useState("");
  const [children, setChildren] = useState<string[]>([]);
  const [version, setVersion] = useState(record.revision);
  const [format, setFormat] = useState<"Markdown" | "PDF">("Markdown");
  const [preview, setPreview] = useState<DocumentTransferPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportPreview, setExportPreview] = useState<Awaited<
    ReturnType<typeof client.exportDocument>
  > | null>(null);
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
  const childOptions = documents.filter((item) => {
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
      childDocumentIds: nextAction === "Copy" ? [] : children,
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
        const snapshot = await client.exportDocument({
          documentId: record.id,
          revision: version,
          format,
        });
        setExportPreview(snapshot);
        return;
      }
      if (action) {
        const result = await client.previewDocumentTransfer(command(action));
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
    setChildren([]);
    setAttachmentIds([]);
    setTargetProjectId("");
    setVersion(record.revision);
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
  function handleTarget(event: ChangeEvent<HTMLSelectElement>) {
    setTargetProjectId(event.target.value);
    resetPreview();
  }
  function handleVersion(event: ChangeEvent<HTMLSelectElement>) {
    setVersion(Number(event.target.value));
    resetPreview();
  }
  function handleFormat(event: ChangeEvent<HTMLSelectElement>) {
    setFormat(event.target.value === "PDF" ? "PDF" : "Markdown");
    resetPreview();
  }
  function handleChild(event: ChangeEvent<HTMLInputElement>) {
    const { value, checked } = event.target;
    setChildren(
      checked ? [...children, value] : children.filter((id) => id !== value),
    );
    resetPreview();
  }
  function handleAttachment(event: ChangeEvent<HTMLInputElement>) {
    const { value, checked } = event.target;
    setAttachmentIds(
      checked
        ? [...attachmentIds, value]
        : attachmentIds.filter((id) => id !== value),
    );
    resetPreview();
  }
  function handlePreview() {
    inspect.mutate();
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
          {action === "Move" || action === "Copy" ? (
            <div className="space-y-2">
              <Label htmlFor="document-target-scope">Target scope</Label>
              <NativeSelect
                disabled={busy}
                id="document-target-scope"
                onChange={handleTarget}
                value={targetProjectId}
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
          ) : null}
          {action === "Assign File Attachments" ? (
            <fieldset className="space-y-2" disabled={busy}>
              <legend>File Attachments</legend>
              <p>
                Select File Attachments from this Project. Attachments already
                owned by another Document cannot be reassigned.
              </p>
              {attachments.data
                ?.filter(
                  (item) =>
                    !item.ownerDocumentId || item.ownerDocumentId === record.id,
                )
                .map((item) => (
                  <Label className="flex gap-2" key={item.id}>
                    <input
                      checked={attachmentIds.includes(item.id)}
                      onChange={handleAttachment}
                      type="checkbox"
                      value={item.id}
                    />
                    {item.name}
                  </Label>
                ))}
            </fieldset>
          ) : null}
          {action === "Move" ? (
            <fieldset className="space-y-2" disabled={busy}>
              <legend>Child Documents</legend>
              {childOptions.map((item) => (
                <Label className="flex gap-2" key={item.id}>
                  <input
                    checked={children.includes(item.id)}
                    onChange={handleChild}
                    type="checkbox"
                    value={item.id}
                  />
                  {item.title}
                </Label>
              ))}
            </fieldset>
          ) : null}
          {action === "Copy" || action === "Export" ? (
            <div className="space-y-2">
              <Label htmlFor="document-transfer-version">Version</Label>
              <NativeSelect
                disabled={busy}
                id="document-transfer-version"
                onChange={handleVersion}
                value={String(version)}
              >
                {(versions.data ?? [{ revision: record.revision }]).map(
                  (item) => (
                    <NativeSelectOption
                      key={item.revision}
                      value={String(item.revision)}
                    >
                      {item.revision}
                    </NativeSelectOption>
                  ),
                )}
              </NativeSelect>
            </div>
          ) : null}
          {action === "Export" ? (
            <div className="space-y-2">
              <Label htmlFor="document-export-format">Format</Label>
              <NativeSelect
                disabled={busy}
                id="document-export-format"
                onChange={handleFormat}
                value={format}
              >
                <NativeSelectOption value="Markdown">
                  Markdown
                </NativeSelectOption>
                <NativeSelectOption value="PDF">PDF</NativeSelectOption>
              </NativeSelect>
              <p>
                Live blocks become dated, read-only snapshots. No live external
                copy is created.
              </p>
              {format === "PDF" ? (
                <p>
                  PDF export does not guarantee tagged PDF or WCAG compliance.
                  Markdown is the accessible alternative.
                </p>
              ) : null}
            </div>
          ) : null}
          {action === "Copy" ? (
            <p>
              Copy creates a new identity with source origin, without history,
              children, File Attachments, relations or publication.
            </p>
          ) : null}
          {preview ? <DocumentTransferPreviewPanel preview={preview} /> : null}
          {exportPreview ? (
            <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-sm">
              {exportPreview.markdown}
            </pre>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={handlePreview}
              type="button"
              variant="outline"
            >
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
        </DialogContent>
      </Dialog>
    </>
  );
}
