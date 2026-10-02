import type {
  DocumentTransferInput,
  DocumentTransferPreview,
} from "@cantiara/api/document-transfers";
import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useId, useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

function referenceStatus(
  reference: DocumentTransferPreview["references"][number],
) {
  if (!reference.available) {
    return "Unavailable";
  }
  return `Available · ${reference.projectId ? "Project" : "Personal Wiki"}`;
}

function transferAttachmentsNote(action: "move" | "copy" | null) {
  return action === "move"
    ? "Document-owned File Attachments move with their owner. Project attachments stay in their current scope."
    : "File Attachments are not copied.";
}

export default function DocumentTransferControls({
  record,
  disabled,
  onCommitted,
}: {
  record: Document;
  disabled: boolean;
  onCommitted: () => Promise<void>;
}) {
  const identifier = useId();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<"move" | "copy" | null>(null);
  const [targetProjectId, setTargetProjectId] = useState("");
  const [sourceRevision, setSourceRevision] = useState(record.revision);
  const [children, setChildren] = useState<
    Array<{ id: string; revision: number }>
  >([]);
  const [descendants, setDescendants] = useState<
    DocumentTransferPreview["descendants"]
  >([]);
  const [preview, setPreview] = useState<DocumentTransferPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<{
    copyDocumentId: string;
    clientIdempotencyKey: string;
  } | null>(null);
  const confirmed = useRef<
    Parameters<typeof client.transferDocument>[0] | null
  >(null);
  const projects = useQuery({
    ...orpc.projects.queryOptions(),
    enabled: action !== null,
  });
  const versions = useQuery({
    ...orpc.documentVersions.queryOptions({ input: { documentId: record.id } }),
    enabled: action === "copy",
  });
  const label = action === "move" ? "Move" : "Copy";
  const command = (): DocumentTransferInput =>
    action === "move"
      ? {
          action,
          documentId: record.id,
          documentRevision: record.revision,
          targetProjectId: targetProjectId || null,
          children,
        }
      : {
          action: "copy",
          documentId: record.id,
          documentRevision: record.revision,
          targetProjectId: targetProjectId || null,
          sourceRevision,
          copyDocumentId:
            pending.current?.copyDocumentId ?? crypto.randomUUID(),
        };
  const inspect = useMutation({
    mutationFn: () => client.previewDocumentTransfer(command()),
    onSuccess: (result) => {
      setPreview(result);
      setDescendants(result.descendants);
      setError(null);
    },
    onError: (failure) => setError(failure.message),
  });
  const apply = useMutation({
    mutationFn: () => {
      const input = command();
      confirmed.current ??= {
        ...input,
        baseRevision: input.action === "copy" ? 0 : input.documentRevision,
        clientIdempotencyKey: pending.current?.clientIdempotencyKey ?? "",
        previewFingerprint: preview?.fingerprint ?? "",
      };
      const confirmedInput = confirmed.current;
      return runOnlineOnlyWrite(() => client.transferDocument(confirmedInput));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
      await queryClient.invalidateQueries({
        queryKey: orpc.documentVersions.key(),
      });
      setAction(null);
      await onCommitted();
    },
    onError: (failure) => {
      setError(failure.message);
    },
  });
  const resetPreview = () => {
    confirmed.current = null;
    setPreview(null);
    setError(null);
    pending.current = {
      copyDocumentId: crypto.randomUUID(),
      clientIdempotencyKey: crypto.randomUUID(),
    };
  };
  const open = (nextAction: "move" | "copy") => {
    setAction(nextAction);
    setTargetProjectId("");
    setSourceRevision(record.revision);
    setChildren([]);
    setDescendants([]);
    resetPreview();
  };
  const busy = inspect.isPending || apply.isPending;
  const openMove = () => open("move");
  const openCopy = () => open("copy");
  const close = () => setAction(null);
  const changeDialog = (openDialog: boolean) => {
    if (!(openDialog || busy)) {
      close();
    }
  };
  const changeScope = (event: ChangeEvent<HTMLSelectElement>) => {
    setTargetProjectId(event.target.value);
    resetPreview();
  };
  const changeVersion = (event: ChangeEvent<HTMLSelectElement>) => {
    setSourceRevision(Number(event.target.value));
    resetPreview();
  };
  const inspectTransfer = () => {
    if (confirmed.current) {
      resetPreview();
    }
    inspect.mutate();
  };
  const applyTransfer = () => apply.mutate();
  return (
    <>
      {record.projectId === null ? null : (
        <Button
          disabled={disabled}
          onClick={openMove}
          type="button"
          variant="outline"
        >
          Move
        </Button>
      )}
      <Button
        disabled={disabled}
        onClick={openCopy}
        type="button"
        variant="outline"
      >
        Copy
      </Button>
      <Dialog onOpenChange={changeDialog} open={action !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>{record.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${identifier}-scope`}>Target scope</Label>
              <NativeSelect
                disabled={busy}
                id={`${identifier}-scope`}
                onChange={changeScope}
                value={targetProjectId}
              >
                <NativeSelectOption value="">Personal Wiki</NativeSelectOption>
                {projects.data
                  ?.filter(
                    (project) =>
                      project.status === "Active" &&
                      (action !== "move" || project.id !== record.projectId),
                  )
                  .map((project) => (
                    <NativeSelectOption key={project.id} value={project.id}>
                      {project.name}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </div>
            {action === "copy" ? (
              <div className="space-y-2">
                <Label htmlFor={`${identifier}-version`}>Version</Label>
                <NativeSelect
                  disabled={busy}
                  id={`${identifier}-version`}
                  onChange={changeVersion}
                  value={sourceRevision}
                >
                  {(versions.data ?? [{ revision: record.revision }]).map(
                    (version) => (
                      <NativeSelectOption
                        key={version.revision}
                        value={version.revision}
                      >
                        Version {version.revision}
                      </NativeSelectOption>
                    ),
                  )}
                </NativeSelect>
              </div>
            ) : null}
            {action === "move" && descendants.length ? (
              <fieldset className="space-y-2">
                <legend>Child Documents</legend>
                {descendants.map((child) => {
                  const changeChild = (
                    event: ChangeEvent<HTMLInputElement>,
                  ) => {
                    setChildren(
                      event.target.checked
                        ? [
                            ...children,
                            { id: child.id, revision: child.revision },
                          ]
                        : children.filter(({ id }) => id !== child.id),
                    );
                    resetPreview();
                  };
                  return (
                    <label className="flex items-center gap-2" key={child.id}>
                      <input
                        checked={children.some(({ id }) => id === child.id)}
                        disabled={busy}
                        onChange={changeChild}
                        type="checkbox"
                      />
                      {child.title}
                    </label>
                  );
                })}
              </fieldset>
            ) : null}
            {preview ? (
              <div
                aria-live="polite"
                className="space-y-2 rounded-md border p-3"
              >
                <p>Private — only you. No sharing or publishing is created.</p>
                <p>
                  {action === "move"
                    ? "Identity, content, versions and archive state are preserved. Only selected Documents move."
                    : "A new Document starts with the selected version and source origin. History, children, attachments and relations are not copied. Future edits stay independent."}
                </p>
                <ul className="list-inside list-disc">
                  {preview.documents.map((item) => (
                    <li key={item.id}>
                      {item.title} · Version {item.revision}
                    </li>
                  ))}
                </ul>
                {preview.detachedChildren.length ? (
                  <>
                    <p>
                      Unselected children stay in their current scope without
                      the moved parent:
                    </p>
                    <ul className="list-inside list-disc">
                      {preview.detachedChildren.map((child) => (
                        <li key={child.id}>{child.title}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                <p>{transferAttachmentsNote(action)}</p>
                <ul className="list-inside list-disc">
                  {preview.attachments.map((attachment) => (
                    <li key={attachment.id}>{attachment.name}</li>
                  ))}
                </ul>
                {preview.references.length ? (
                  <>
                    <p>
                      Record references retain their source scope and access
                      requirements:
                    </p>
                    <p>
                      Unavailable references remain broken. Availability can
                      change after Preview.
                    </p>
                    <ul className="list-inside list-disc">
                      {preview.references.map((reference) => (
                        <li
                          key={`${reference.recordType}-${reference.id}-${reference.title}`}
                        >
                          {reference.recordType}: {reference.title} ·{" "}
                          {referenceStatus(reference)}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>No record references.</p>
                )}
                {preview.reason ? <p role="alert">{preview.reason}</p> : null}
              </div>
            ) : null}
            {error ? <p role="alert">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              disabled={busy}
              onClick={close}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={busy || disabled}
              onClick={inspectTransfer}
              type="button"
              variant="outline"
            >
              Preview
            </Button>
            <Button
              disabled={busy || disabled || !preview?.allowed}
              onClick={applyTransfer}
              type="button"
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
