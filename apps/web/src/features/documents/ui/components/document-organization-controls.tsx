import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
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
  const [action, setAction] = useState<"hierarchy" | "archive" | null>(null);
  const [openCount, setOpenCount] = useState(0);
  const archiveLabel = record.archivedAt ? "Unarchive" : "Archive";
  function open(next: "hierarchy" | "archive") {
    setOpenCount((count) => count + 1);
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
      <DocumentOrganizationForm
        action={action}
        documents={documents}
        key={openCount}
        onClose={closeDialog}
        onCommitted={onCommitted}
        record={record}
      />
    </div>
  );
}
