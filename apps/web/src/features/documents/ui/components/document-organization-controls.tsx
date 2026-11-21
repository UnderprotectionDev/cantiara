// biome-ignore-all lint/performance/noJsxPropsBind: The close guard reads the current form submission.
import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import {
  createDialogHandle,
  Dialog,
  DialogTrigger,
} from "@cantiara/ui/components/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { isPopupCommandPending } from "@/lib/is-popup-command-pending";
import DocumentOrganizationForm from "../forms/document-organization-form";

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
  const [handle] = useState(createDialogHandle<"hierarchy" | "archive">);
  const popupId = useId();
  const queryClient = useQueryClient();
  const archiveLabel = record.archivedAt ? "Unarchive" : "Archive";
  function close() {
    if (handle.isOpen) {
      handle.close();
    }
  }
  const parent = documents.find(({ id }) => id === record.parentDocumentId);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DialogTrigger
          disabled={disabled}
          handle={handle}
          payload="hierarchy"
          render={<Button variant="outline" />}
        >
          Organize Document
        </DialogTrigger>
        <DialogTrigger
          disabled={disabled}
          handle={handle}
          payload="archive"
          render={<Button variant="outline" />}
        >
          {archiveLabel}
        </DialogTrigger>
        {record.folder ? (
          <p className="text-sm text-muted-foreground">
            Folder: {record.folder}
          </p>
        ) : null}
        {parent ? (
          <p className="text-sm text-muted-foreground">
            Parent Document: {parent.title}
          </p>
        ) : null}
      </div>
      {disabled ? (
        <p className="text-sm text-muted-foreground">
          Save your changes before organizing or archiving this Document.
        </p>
      ) : null}
      <Dialog
        handle={handle}
        onOpenChange={(open, event) => {
          if (
            !open &&
            isPopupCommandPending(queryClient, popupId) &&
            event.reason !== "imperative-action"
          ) {
            event.cancel();
          }
        }}
      >
        {({ payload }) =>
          payload ? (
            <DocumentOrganizationForm
              action={payload}
              documents={documents}
              key={payload}
              onClose={close}
              onCommitted={onCommitted}
              popupId={popupId}
              record={record}
            />
          ) : null
        }
      </Dialog>
    </div>
  );
}
