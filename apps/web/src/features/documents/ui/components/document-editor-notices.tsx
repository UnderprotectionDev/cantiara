// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import type { Document } from "@cantiara/api/documents";
import { AppLink } from "@/components/app-link";
import { documentRecordHash } from "@/features/project-shell/lib/project-shell-navigation";

export function DocumentConvertedDiagramNotice({
  convertedDiagram,
  record,
}: {
  convertedDiagram: { id: string; title: string } | null;
  record: Document;
}) {
  return convertedDiagram && record.projectId !== null ? (
    <div
      className="rounded-md border border-border bg-muted/50 p-3 text-sm"
      role="status"
    >
      <p>Technical Diagram: {convertedDiagram.title}</p>
      <AppLink
        className="underline"
        href={`/projects/${encodeURIComponent(record.projectId ?? "")}#technical-diagram-${encodeURIComponent(convertedDiagram.id)}`}
      >
        Open source record
      </AppLink>
    </div>
  ) : null;
}

export function DocumentOriginNotice({
  record,
  originDocument,
}: {
  record: Document;
  originDocument: import("@tanstack/react-query").UseQueryResult<
    Document,
    Error
  >;
}) {
  return record.origin ? (
    <p className="mb-4 text-sm">
      {record.origin.conflictDraftId ? "Conflict Draft origin" : "Copy origin"}{" "}
      · Version {record.origin.revision} ·{" "}
      {originDocument.data ? (
        <AppLink
          className="underline"
          href={`${originDocument.data.projectId === null ? "/personal-wiki" : `/projects/${encodeURIComponent(originDocument.data.projectId)}`}#${documentRecordHash(record.origin.documentId)}`}
        >
          Open source record
        </AppLink>
      ) : (
        !originDocument.isPending && "Source record is unavailable."
      )}
    </p>
  ) : null;
}
