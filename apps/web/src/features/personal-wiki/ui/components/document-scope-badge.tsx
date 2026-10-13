import type { Document } from "@cantiara/api/documents";
import { Badge } from "@cantiara/ui/components/badge";

import { documentScopeLabel } from "../../document-scope";

export default function DocumentScopeBadge({
  document,
  projectName,
  idPrefix = "document-scope",
}: {
  document: Pick<Document, "id" | "projectId">;
  projectName?: string | null;
  idPrefix?: string;
}) {
  return (
    <Badge id={`${idPrefix}-${document.id}`} variant="outline">
      {document.projectId !== null && projectName
        ? `Project: ${projectName}`
        : documentScopeLabel(document.projectId)}
    </Badge>
  );
}
