import type { Document } from "@cantiara/api/documents";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import {
  type DocumentView,
  uniqueDocumentSections,
} from "../lib/document-editor-markdown";

export function useDocumentReferenceSources(
  record: Document,
  view: DocumentView,
  sectionDocumentId: string,
  selectedDiagramId: string,
) {
  const projectId = record.projectId ?? "";
  const projectMarkdownEnabled =
    view === "markdown" && record.projectId !== null;
  const collectionViews = useQuery({
    ...orpc.smartCollectionViews.queryOptions({
      input: { projectId },
    }),
    enabled: projectMarkdownEnabled,
  });
  const documentsForSections = useQuery({
    ...orpc.documents.queryOptions({
      input: { projectId: record.projectId },
    }),
    enabled: view === "markdown",
  });
  const sourceRecords = useQuery({
    ...orpc.projectSourceRecords.queryOptions({
      input: { projectId },
    }),
    enabled: projectMarkdownEnabled,
  });
  const sectionSourceDocument = documentsForSections.data?.find(
    ({ id }) => id === sectionDocumentId,
  );
  const availableSections = sectionSourceDocument
    ? uniqueDocumentSections(sectionSourceDocument.body)
    : [];
  const diagrams = useQuery({
    ...orpc.technicalDiagrams.queryOptions({
      input: { projectId },
    }),
    enabled: projectMarkdownEnabled,
  });
  const diagramViews = useQuery({
    ...orpc.technicalDiagramViews.queryOptions({
      input: { diagramId: selectedDiagramId },
    }),
    enabled: view === "markdown" && selectedDiagramId.length > 0,
  });
  const diagramVersions = useQuery({
    ...orpc.technicalDiagramVersions.queryOptions({
      input: { diagramId: selectedDiagramId },
    }),
    enabled: view === "markdown" && selectedDiagramId.length > 0,
  });
  return {
    collectionViews,
    documentsForSections,
    sectionSourceDocument,
    availableSections,
    diagrams,
    diagramViews,
    diagramVersions,
    sourceRecords,
  };
}

export function useDocumentWorkSources(record: Document, view: DocumentView) {
  const works = useQuery({
    ...orpc.projectWorks.queryOptions({
      input: { projectId: record.projectId ?? "" },
    }),
    enabled: view === "markdown" && record.projectId !== null,
  });
  return works;
}
