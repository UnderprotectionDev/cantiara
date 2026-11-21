// biome-ignore-all lint/performance/noJsxPropsBind: Form fields and action buttons close over the current TanStack Form field handlers and dialog state.

import {
  type Document,
  type DocumentHierarchyPreview,
  documentOrganizationInputSchema,
} from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import {
  DialogClose,
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
import { useRef } from "react";
import { commandVariables } from "@/lib/command-variables";
import { submitForm } from "@/lib/submit-form";
import { client, orpc } from "@/utils/orpc";

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
  popupId,
}: {
  action: "hierarchy" | "archive";
  documents: Document[];
  onClose: () => void;
  onCommitted: (document: Document) => Promise<void>;
  record: Document;
  popupId: string;
}) {
  const archived = Boolean(record.archivedAt);
  const archiveLabel = archived ? "Unarchive" : "Archive";
  const label = action === "hierarchy" ? "Organize Document" : archiveLabel;
  const otherDocuments = documents.filter(({ id }) => id !== record.id);
  const inspect = useMutation(
    orpc.previewDocumentOrganization.mutationOptions({
      meta: { popupId },
      mutationFn: (input) => client.previewDocumentOrganization(input),
    }),
  );
  const apply = useMutation(
    orpc.organizeDocument.mutationOptions({
      meta: { onlineWrite: true, popupId },
      mutationFn: (input) => client.organizeDocument(input),
      onSuccess: async (saved) => {
        await onCommitted(saved);
        inspect.reset();
        onClose();
      },
    }),
  );
  const preview = inspect.data;
  const previewRevision = useRef(record.revision);
  const error = (apply.error ?? inspect.error)?.message;
  const form = useForm({
    defaultValues: {
      folder: record.folder ?? "",
      parentDocumentId: record.parentDocumentId ?? "",
    },
    onSubmitMeta: { action: "preview" } as { action: "preview" | "apply" },
    onSubmit: async ({ value, meta, formApi }) => {
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
        formApi.setErrorMap({
          onSubmit: {
            form: parsed.error.issues[0]?.message ?? "Check the form.",
            fields: {},
          },
        });
        return;
      }
      if (meta.action === "apply") {
        const reviewed = inspect.variables;
        if (inspect.isSuccess && reviewed) {
          await apply.mutateAsync(
            (apply.isError && apply.variables) ||
              commandVariables({
                ...reviewed,
                baseRevision: previewRevision.current,
              }),
          );
        }
        return;
      }
      apply.reset();
      previewRevision.current = record.revision;
      await inspect.mutateAsync(parsed.data);
    },
  });
  const pending = inspect.isPending || apply.isPending;
  function submit(intent: "preview" | "apply") {
    return submitForm(form, { action: intent });
  }
  function invalidatePreview() {
    inspect.reset();
    apply.reset();
    form.setErrorMap({ onSubmit: undefined });
  }
  return (
    <DialogContent showCloseButton={!pending}>
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
          submit("preview").catch(() => undefined);
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
          <Button type="submit" variant="outline">
            Preview
          </Button>
        </fieldset>
        {preview ? (
          <DocumentOrganizationPreview
            hierarchy={action === "hierarchy"}
            preview={preview}
          />
        ) : null}
        <form.Subscribe selector={(state): unknown => state.errorMap.onSubmit}>
          {(validationError) => {
            const message =
              typeof validationError === "string" ? validationError : error;
            return message ? <p role="alert">{message}</p> : null;
          }}
        </form.Subscribe>
        <DialogFooter>
          <DialogClose disabled={pending} render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={!preview?.allowed || pending}
            onClick={() => {
              submit("apply").catch(() => undefined);
            }}
            type="button"
          >
            Apply
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
