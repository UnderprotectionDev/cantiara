// biome-ignore-all lint/performance/noJsxPropsBind: Form fields and action buttons close over the current TanStack Form field handlers and dialog state.
import {
  type Document,
  type DocumentHierarchyPreview,
  type DocumentOrganizationInput,
  documentOrganizationInputSchema,
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
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client } from "@/utils/orpc";

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

export default function DocumentOrganizationForm({
  action,
  documents,
  onClose,
  onCommitted,
  record,
}: {
  action: "hierarchy" | "archive" | null;
  documents: Document[];
  onClose: () => void;
  onCommitted: (document: Document) => Promise<void>;
  record: Document;
}) {
  const [preview, setPreview] = useState<DocumentHierarchyPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const submitAction = useRef<"preview" | "apply">("preview");
  const archived = Boolean(record.archivedAt);
  const archiveLabel = archived ? "Unarchive" : "Archive";
  const label = action === "hierarchy" ? "Organize Document" : archiveLabel;
  const otherDocuments = documents.filter(({ id }) => id !== record.id);
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
    mutationFn: (command: DocumentOrganizationInput) => {
      idempotencyKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.organizeDocument({
          ...command,
          baseRevision: record.revision,
          clientIdempotencyKey: idempotencyKey.current ?? "",
        }),
      );
    },
    onSuccess: async (saved) => {
      await onCommitted(saved);
      onClose();
      setPreview(null);
      idempotencyKey.current = null;
    },
    onError: (failure) => setError(failure.message),
  });
  const form = useForm({
    defaultValues: {
      folder: record.folder ?? "",
      parentDocumentId: record.parentDocumentId ?? "",
    },
    onSubmit: ({ value }) => {
      const parsed = documentOrganizationInputSchema.safeParse(
        action === "hierarchy"
          ? {
              action,
              documentId: record.id,
              folder: value.folder.trim() || null,
              parentDocumentId: value.parentDocumentId || null,
            }
          : { action: "archive", documentId: record.id, archived: !archived },
      );
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check the form.");
        return;
      }
      if (submitAction.current === "apply") {
        apply.mutate(parsed.data);
        return;
      }
      inspect.mutate(parsed.data);
    },
  });
  const pending = inspect.isPending || apply.isPending;
  function changeOpen(openState: boolean) {
    if (!(openState || pending)) {
      onClose();
    }
  }
  function invalidatePreview() {
    setPreview(null);
    idempotencyKey.current = null;
  }
  return (
    <Dialog onOpenChange={changeOpen} open={action !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Preview changes in the same Project. Document identity, content, and
            child links are preserved.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit().catch(() => undefined);
          }}
        >
          <fieldset className="space-y-3" disabled={pending}>
            {action === "hierarchy" ? (
              <>
                <form.Field name="folder">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="document-folder">Folder</Label>
                      <Input
                        id="document-folder"
                        list="document-folder-options"
                        maxLength={255}
                        name={field.name}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          invalidatePreview();
                        }}
                        value={field.state.value}
                      />
                      <datalist id="document-folder-options">
                        {[
                          ...new Set(
                            otherDocuments.flatMap((item) =>
                              item.folder ? [item.folder] : [],
                            ),
                          ),
                        ].map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>
                  )}
                </form.Field>
                <form.Field name="parentDocumentId">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="document-parent">Parent Document</Label>
                      <NativeSelect
                        id="document-parent"
                        name={field.name}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          invalidatePreview();
                        }}
                        value={field.state.value}
                      >
                        <NativeSelectOption value="">
                          No Parent Document
                        </NativeSelectOption>
                        {otherDocuments.map((item) => (
                          <NativeSelectOption key={item.id} value={item.id}>
                            {item.title}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                  )}
                </form.Field>
              </>
            ) : (
              <p>
                {archived
                  ? "The Document will return to normal navigation."
                  : "The Document will leave normal navigation and remain available through Archived."}
              </p>
            )}
            <Button
              onClick={() => {
                submitAction.current = "preview";
              }}
              type="submit"
              variant="outline"
            >
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
              disabled={pending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!preview?.allowed || pending}
              onClick={() => {
                submitAction.current = "apply";
              }}
              type="submit"
            >
              Apply
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
