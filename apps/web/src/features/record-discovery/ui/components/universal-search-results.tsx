import {
  documentMatchParts,
  type RecordDiscoveryView,
  type UniversalSearchRecordType,
  type UniversalSearchResult,
} from "@cantiara/api/record-discovery";
import { Badge } from "@cantiara/ui/components/badge";
import {
  documentRecordHash,
  projectSourceRecordHash,
  workRecordHash,
} from "@/features/project-shell/lib/project-shell-navigation";

function MatchSnippet({ snippet, query }: { snippet: string; query: string }) {
  return (
    <p className="text-muted-foreground text-sm">
      {documentMatchParts(snippet, query).map((part) =>
        part.matched ? <mark key={part.start}>{part.text}</mark> : part.text,
      )}
    </p>
  );
}

function resultHref(result: UniversalSearchResult) {
  if (result.recordType === "Document") {
    return result.projectId
      ? `/projects/${encodeURIComponent(result.projectId)}#${documentRecordHash(result.id)}`
      : `/personal-wiki#${documentRecordHash(result.id)}`;
  }

  if (result.recordType === "File Attachment") {
    if (result.ownerDocumentId) {
      const path = result.projectId
        ? `/projects/${encodeURIComponent(result.projectId)}`
        : "/personal-wiki";
      return `${path}#${documentRecordHash(result.ownerDocumentId)}`;
    }
    return result.projectId
      ? `/projects/${encodeURIComponent(result.projectId)}#documents`
      : "/personal-wiki#files";
  }

  if (result.recordType === "Work" && result.projectId) {
    return `/projects/${encodeURIComponent(result.projectId)}#${workRecordHash(result.id)}`;
  }

  if (result.recordType === "Technical Diagram" && result.projectId) {
    return `/projects/${encodeURIComponent(result.projectId)}#technical-diagram-${encodeURIComponent(result.id)}`;
  }

  if (result.projectId) {
    const sourceTypes: Partial<
      Record<
        UniversalSearchRecordType,
        Parameters<typeof projectSourceRecordHash>[0]
      >
    > = {
      Assumption: "Assumption",
      Decision: "Decision",
      "Open Question": "Open Question",
      Milestone: "Milestone",
      "Project Release": "Project Release",
      "Production Incident": "Production Incident",
      Risk: "Risk",
    };
    const sourceType = sourceTypes[result.recordType];
    if (sourceType) {
      return `/projects/${encodeURIComponent(result.projectId)}#${projectSourceRecordHash(sourceType, result.id)}`;
    }
    return `/projects/${encodeURIComponent(result.projectId)}`;
  }

  return "/projects";
}

function IndexMetadata({
  index,
  result,
}: {
  index: RecordDiscoveryView;
  result: UniversalSearchResult;
}) {
  const isFilesIndex = index === "All Files";
  const showFolder = index === "All Documents" || isFilesIndex;
  const authorityMode =
    index === "All Technical Diagrams" ? result.authorityMode : null;
  const fileName =
    isFilesIndex && result.fileName !== result.title ? result.fileName : null;
  const fileMimeType = isFilesIndex ? result.fileMimeType : null;
  const folder = showFolder ? result.folder : null;
  const scope =
    result.scopeType === "Project"
      ? `Project: ${result.scopeName}`
      : "Personal Wiki";

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">{result.recordType}</Badge>
      {result.category ? (
        <Badge variant="outline">{result.category}</Badge>
      ) : null}
      {authorityMode ? <Badge variant="outline">{authorityMode}</Badge> : null}
      {fileName ? <Badge variant="outline">{fileName}</Badge> : null}
      {fileMimeType ? <Badge variant="outline">{fileMimeType}</Badge> : null}
      <Badge variant="outline">{result.status}</Badge>
      {result.closureResult ? (
        <Badge variant="outline">{result.closureResult}</Badge>
      ) : null}
      <Badge variant="outline">{scope}</Badge>
      {folder ? (
        <span className="text-muted-foreground text-sm">Folder: {folder}</span>
      ) : null}
    </div>
  );
}

function SearchMatchDetails({
  query,
  result,
}: {
  query: string;
  result: UniversalSearchResult;
}) {
  return (
    <>
      <MatchSnippet query={query} snippet={result.snippet} />
      <p className="text-muted-foreground text-sm">
        {result.matchCount} {result.matchCount === 1 ? "match" : "matches"}
      </p>
    </>
  );
}

function UniversalSearchResultItem({
  index,
  onOpenSource,
  query,
  result,
}: {
  index: RecordDiscoveryView;
  onOpenSource?: () => void;
  query: string;
  result: UniversalSearchResult;
}) {
  return (
    <li className="space-y-2 rounded-md border p-3" data-record-id={result.id}>
      <h3 className="font-medium">{result.title}</h3>
      <IndexMetadata index={index} result={result} />
      {index === "Search" ? (
        <SearchMatchDetails query={query} result={result} />
      ) : null}
      <a
        aria-label={index === "Search" ? `Open ${result.title}` : undefined}
        className="text-primary underline"
        href={resultHref(result)}
        onClick={onOpenSource}
      >
        Open source record
      </a>
    </li>
  );
}

export default function UniversalSearchResults({
  index = "Search",
  results,
  query,
  onOpenSource,
}: {
  index?: RecordDiscoveryView;
  results: UniversalSearchResult[];
  query: string;
  onOpenSource?: () => void;
}) {
  return (
    <ul
      aria-label={index === "Search" ? "Search results" : index}
      className="space-y-3"
    >
      {results.map((result) => (
        <UniversalSearchResultItem
          index={index}
          key={`${result.recordType}:${result.id}`}
          onOpenSource={onOpenSource}
          query={query}
          result={result}
        />
      ))}
    </ul>
  );
}
