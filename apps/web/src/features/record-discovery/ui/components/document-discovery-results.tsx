import {
  type DocumentDiscoveryResult,
  documentMatchParts,
} from "@cantiara/api/record-discovery";
import { Badge } from "@cantiara/ui/components/badge";
import { Link } from "@tanstack/react-router";
import DocumentScopeBadge from "@/features/personal-wiki/ui/components/document-scope-badge";
import { documentRecordHash } from "@/features/project-shell/lib/project-shell-navigation";

function MatchSnippet({ snippet, query }: { snippet: string; query: string }) {
  return (
    <p className="text-muted-foreground text-sm">
      {documentMatchParts(snippet, query).map((part) =>
        part.matched ? <mark key={part.start}>{part.text}</mark> : part.text,
      )}
    </p>
  );
}

export default function DocumentDiscoveryResults({
  results,
  query,
  onOpenSource,
}: {
  results: DocumentDiscoveryResult[];
  query: string;
  onOpenSource?: () => void;
}) {
  return (
    <ul aria-label="All Documents" className="space-y-3">
      {results.map(
        ({
          document,
          projectArchivedAt,
          projectName,
          projectStatus,
          snippet,
          matchCount,
        }) => (
          <li
            className="space-y-2 rounded-md border p-3"
            data-document-id={document.id}
            key={document.id}
          >
            <h3 className="font-medium">{document.title}</h3>
            <div className="flex flex-wrap gap-2">
              <DocumentScopeBadge
                document={document}
                idPrefix="discovery-scope"
                projectName={projectName}
              />
              <Badge variant="outline">{document.type}</Badge>
              <Badge variant="outline">
                {document.archivedAt || projectArchivedAt
                  ? "Archived"
                  : (projectStatus ?? "Active")}
              </Badge>
              {!!document.folder && (
                <span className="text-muted-foreground text-sm">
                  {document.folder}
                </span>
              )}
            </div>
            {!!query && (
              <>
                <MatchSnippet query={query} snippet={snippet} />
                <p className="text-muted-foreground text-sm">
                  {matchCount} matches
                </p>
              </>
            )}
            <Link
              aria-describedby={`discovery-scope-${document.id}`}
              className="text-primary underline"
              hash={documentRecordHash(document.id)}
              onClick={onOpenSource}
              params={
                document.projectId === null
                  ? {}
                  : { projectId: document.projectId }
              }
              to={
                document.projectId === null
                  ? "/personal-wiki"
                  : "/projects/$projectId"
              }
            >
              Open source record
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}
