import type { Document } from "@cantiara/api/documents";
import { Badge } from "@cantiara/ui/components/badge";

import { documentScopeLabel } from "../../document-scope";

export default function DocumentScopeBadge({
  document,
}: {
  document: Pick<Document, "id" | "projectId">;
}) {
  return (
    <Badge id={`document-scope-${document.id}`} variant="outline">
      {documentScopeLabel(document.projectId)}
    </Badge>
  );
}
