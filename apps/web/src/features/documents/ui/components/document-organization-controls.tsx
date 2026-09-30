import type {
  Document,
  DocumentHierarchyPreview,
  DocumentOrganizationInput,
} from "@cantiara/api/documents";
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
import { useMutation } from "@tanstack/react-query";
import { type ChangeEvent, useRef, useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client } from "@/utils/orpc";

function DocumentHierarchyFields({
  documents,
  folder,
  parentDocumentId,
  onFolderChange,
  onParentChange,
}: {
  documents: Document[];
  folder: string;
  parentDocumentId: string;
  onFolderChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onParentChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  const folders = [
    ...new Set(documents.flatMap((item) => (item.folder ? [item.folder] : []))),
  ];
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="document-folder">Folder</Label>
        <Input
          id="document-folder"
          list="document-folder-options"
          maxLength={255}
          onChange={onFolderChange}
          value={folder}
        />
        <datalist id="document-folder-options">
          {folders.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
      <div className="space-y-2">
        <Label htmlFor="document-parent">Parent Document</Label>
        <NativeSelect
          id="document-parent"
          onChange={onParentChange}
          value={parentDocumentId}
        >
          <NativeSelectOption value="">No Parent Document</NativeSelectOption>
          {documents.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.title}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </>
  );
}

function DocumentOrganizationPreview({
  preview,
  hierarchy,
}: {
  preview: DocumentHierarchyPreview;
  hierarchy: boolean;
}) {
  return (
    <div aria-live="polite" className="space-y-2 rounded-md border p-3">
      {hierarchy ? <p>Document level: {preview.depth}</p> : null}
      {preview.reason ? <p role="alert">{preview.reason}</p> : null}
      <p>
        Children keep their current parent links, folders, and archive state.
      </p>
      {preview.descendants?.length ? (
        <ul className="list-inside list-disc">
          {preview.descendants.map((child) => (
            <li key={child.id}>
              {child.title}
              {child.archivedAt ? " (Archived)" : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p>No child Documents.</p>
      )}
    </div>
  );
}

export default function DocumentOrganizationControls({
  record,
  documents,
  disabled,
  onCommitted,
}: {
  record: Document;
  documents: Document[];
  disabled: boolean;
  onCommitted: (document: Document) => Promise<void>;
}) {
  const [action, setAction] = useState<"hierarchy" | "archive" | null>(null);
  const [folder, setFolder] = useState(record.folder ?? "");
  const [parentDocumentId, setParentDocumentId] = useState(
    record.parentDocumentId ?? "",
  );
  const [preview, setPreview] = useState<DocumentHierarchyPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const archived = Boolean(record.archivedAt);
  const archiveLabel = archived ? "Unarchive" : "Archive";
  const label = action === "hierarchy" ? "Organize Document" : archiveLabel;
  const input: DocumentOrganizationInput =
    action === "hierarchy"
      ? {
          action,
          documentId: record.id,
          folder: folder.trim() || null,
          parentDocumentId: parentDocumentId || null,
        }
      : { action: "archive", documentId: record.id, archived: !archived };
  const inspect = useMutation({
    mutationFn: (command: DocumentOrganizationInput) =>
      client.previewDocumentOrganization(command),
    onSuccess: (result) => {
      setPreview(result);
      setError(null);
    },
    onError: (failure) => setError(failure.message),
  });
  const apply = useMutation({
    mutationFn: () => {
      idempotencyKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.organizeDocument({
          ...input,
          baseRevision: record.revision,
          clientIdempotencyKey: idempotencyKey.current ?? "",
        }),
      );
    },
    onSuccess: async (saved) => {
      await onCommitted(saved);
      setAction(null);
      setPreview(null);
      idempotencyKey.current = null;
    },
    onError: (failure) => setError(failure.message),
  });
  function open(next: "hierarchy" | "archive") {
    setFolder(record.folder ?? "");
    setParentDocumentId(record.parentDocumentId ?? "");
    setPreview(null);
    setError(null);
    idempotencyKey.current = null;
    setAction(next);
  }
  function openHierarchy() {
    open("hierarchy");
  }
  function openArchive() {
    open("archive");
  }
  function closeDialog() {
    setAction(null);
  }
  function changeOpen(openState: boolean) {
    if (!(openState || apply.isPending || inspect.isPending)) {
      closeDialog();
    }
  }
  function changeFolder(event: ChangeEvent<HTMLInputElement>) {
    setFolder(event.target.value);
    setPreview(null);
    idempotencyKey.current = null;
  }
  function changeParent(event: ChangeEvent<HTMLSelectElement>) {
    setParentDocumentId(event.target.value);
    setPreview(null);
    idempotencyKey.current = null;
  }
  function requestPreview() {
    inspect.mutate(input);
  }
  function applyChanges() {
    apply.mutate();
  }
  const parent = documents.find(({ id }) => id === record.parentDocumentId);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={disabled}
          onClick={openHierarchy}
          type="button"
          variant="outline"
        >
          Organize Document
        </Button>
        <Button
          disabled={disabled}
          onClick={openArchive}
          type="button"
          variant="outline"
        >
          {archiveLabel}
        </Button>
        {record.folder ? (
          <p className="text-muted-foreground text-sm">
            Folder: {record.folder}
          </p>
        ) : null}
        {parent ? (
          <p className="text-muted-foreground text-sm">
            Parent Document: {parent.title}
          </p>
        ) : null}
      </div>
      {disabled ? (
        <p className="text-muted-foreground text-sm">
          Save your changes before organizing or archiving this Document.
        </p>
      ) : null}
      <Dialog onOpenChange={changeOpen} open={action !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              Preview changes in the same Project. Document identity, content,
              and child links are preserved.
            </DialogDescription>
          </DialogHeader>
          <fieldset
            className="space-y-3"
            disabled={inspect.isPending || apply.isPending}
          >
            {action === "hierarchy" ? (
              <DocumentHierarchyFields
                documents={documents.filter(({ id }) => id !== record.id)}
                folder={folder}
                onFolderChange={changeFolder}
                onParentChange={changeParent}
                parentDocumentId={parentDocumentId}
              />
            ) : (
              <p>
                {archived
                  ? "The Document will return to normal navigation."
                  : "The Document will leave normal navigation and remain available through Archived."}
              </p>
            )}
            <Button onClick={requestPreview} type="button" variant="outline">
              Preview
            </Button>
          </fieldset>
          {preview ? (
            <DocumentOrganizationPreview
              hierarchy={action === "hierarchy"}
              preview={preview}
            />
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
          <DialogFooter>
            <Button
              disabled={apply.isPending || inspect.isPending}
              onClick={closeDialog}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={
                !preview?.allowed || apply.isPending || inspect.isPending
              }
              onClick={applyChanges}
              type="button"
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
