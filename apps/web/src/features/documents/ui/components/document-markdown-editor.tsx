// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import type { Document } from "@cantiara/api/documents";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { AppLink } from "@/components/app-link";
import type { DocumentListRow } from "../../lib/document-editor-markdown";

export default function DocumentMarkdownEditor({
  field,
  works,
  setSectionDocumentId,
  setSectionId,
  sectionDocumentId,
  documentsForSections,
  record,
  sectionSourceDocument,
  sectionId,
  availableSections,
  collectionViews,
  setSelectedDiagramId,
  selectedDiagramId,
  diagrams,
  diagramViews,
  diagramVersions,
  setRecordReferenceChoice,
  recordReferenceChoice,
  recordReferenceOptions,
  setSelectedTextRange,
  setConversionWarning,
  selectedTextRange,
  pinEvidenceKey,
  savedBody,
  setPinEvidenceOpen,
  recordConversionKey,
  recordConversionId,
  setRecordConversionOpen,
  bulkRows,
  setBulkConversionOpen,
}: {
  field: { state: { value: string }; handleChange: (value: string) => void };
  works: import("@tanstack/react-query").UseQueryResult<WorkProfile[], Error>;
  setSectionDocumentId: import("react").Dispatch<
    import("react").SetStateAction<string>
  >;
  setSectionId: import("react").Dispatch<
    import("react").SetStateAction<string>
  >;
  sectionDocumentId: string;
  documentsForSections: import("@tanstack/react-query").UseQueryResult<
    Document[],
    Error
  >;
  record: Document;
  sectionSourceDocument: Document | undefined;
  sectionId: string;
  availableSections: import("@cantiara/api/documents").DocumentSection[];
  collectionViews: import("@tanstack/react-query").UseQueryResult<
    import("@cantiara/api/smart-collections").SmartCollectionViewSource[],
    Error
  >;
  setSelectedDiagramId: import("react").Dispatch<
    import("react").SetStateAction<string>
  >;
  selectedDiagramId: string;
  diagrams: import("@tanstack/react-query").UseQueryResult<
    import("@cantiara/api/technical-diagrams").TechnicalDiagramSource[],
    Error
  >;
  diagramViews: import("@tanstack/react-query").UseQueryResult<
    { id: string; name: string; selectedNodeIds: string[] }[],
    Error
  >;
  diagramVersions: import("@tanstack/react-query").UseQueryResult<
    { id: string; name: string; number: number }[],
    Error
  >;
  setRecordReferenceChoice: import("react").Dispatch<
    import("react").SetStateAction<string>
  >;
  recordReferenceChoice: string;
  recordReferenceOptions: { id: string; label: string; recordType: string }[];
  setSelectedTextRange: import("react").Dispatch<
    import("react").SetStateAction<{ end: number; start: number } | null>
  >;
  setConversionWarning: import("react").Dispatch<
    import("react").SetStateAction<boolean>
  >;
  selectedTextRange: { end: number; start: number } | null;
  pinEvidenceKey: import("react").RefObject<string | null>;
  savedBody: string;
  setPinEvidenceOpen: import("react").Dispatch<
    import("react").SetStateAction<boolean>
  >;
  recordConversionKey: import("react").RefObject<string | null>;
  recordConversionId: import("react").RefObject<string | null>;
  setRecordConversionOpen: import("react").Dispatch<
    import("react").SetStateAction<boolean>
  >;
  bulkRows: DocumentListRow[];
  setBulkConversionOpen: import("react").Dispatch<
    import("react").SetStateAction<boolean>
  >;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="document-live-work">Live Work block</Label>
      <NativeSelect
        id="document-live-work"
        onChange={(event) => {
          const workId = event.target.value;
          if (!workId) {
            return;
          }
          const spacer = field.state.value.trimEnd() ? "\n\n" : "";
          field.handleChange(
            `${field.state.value.trimEnd()}${spacer}:::live-work{workId="${workId}"}\n`,
          );
        }}
        value=""
      >
        <NativeSelectOption value="">Live Work block</NativeSelectOption>
        {works.data?.map((work) => (
          <NativeSelectOption key={work.id} value={work.id}>
            {work.key} · {work.title}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Label htmlFor="document-live-section-document">
        Read-only live section
      </Label>
      <NativeSelect
        id="document-live-section-document"
        onChange={(event) => {
          setSectionDocumentId(event.target.value);
          setSectionId("");
        }}
        value={sectionDocumentId}
      >
        <NativeSelectOption value="">Choose a Document</NativeSelectOption>
        {documentsForSections.data
          ?.filter(({ id }) => id !== record.id)
          .map((candidate) => (
            <NativeSelectOption key={candidate.id} value={candidate.id}>
              {candidate.title}
            </NativeSelectOption>
          ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Document section"
        disabled={!sectionSourceDocument}
        onChange={(event) => setSectionId(event.target.value)}
        value={sectionId}
      >
        <NativeSelectOption value="">Choose a section</NativeSelectOption>
        {availableSections.map((section) => (
          <NativeSelectOption key={section.id} value={section.id}>
            {section.heading}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button
        disabled={!(sectionDocumentId && sectionId)}
        onClick={() => {
          const spacer = field.state.value.trimEnd() ? "\n\n" : "";
          field.handleChange(
            `${field.state.value.trimEnd()}${spacer}:::live-section{documentId="${sectionDocumentId}" sectionId="${sectionId}"}\n`,
          );
        }}
        type="button"
        variant="outline"
      >
        Insert Read-only live section
      </Button>
      <Label htmlFor="document-live-collection">Named view</Label>
      <NativeSelect
        id="document-live-collection"
        onChange={(event) => {
          const viewId = event.target.value;
          if (viewId) {
            const spacer = field.state.value.trimEnd() ? "\n\n" : "";
            field.handleChange(
              `${field.state.value.trimEnd()}${spacer}:::live-collection{viewId="${viewId}"}\n`,
            );
          }
        }}
        value=""
      >
        <NativeSelectOption value="">Named view</NativeSelectOption>
        {collectionViews.data?.map((source) => (
          <NativeSelectOption key={source.id} value={source.id}>
            {source.collectionName} · {source.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {record.projectId === null ? null : (
        <AppLink
          className="text-sm underline"
          href={`/projects/${record.projectId}#smart-collections`}
        >
          Smart Collection
        </AppLink>
      )}
      <Label htmlFor="document-live-diagram">Technical Diagram</Label>
      <NativeSelect
        id="document-live-diagram"
        onChange={(event) => setSelectedDiagramId(event.target.value)}
        value={selectedDiagramId}
      >
        <NativeSelectOption value="">Technical Diagram</NativeSelectOption>
        {diagrams.data?.map((source) => (
          <NativeSelectOption key={source.id} value={source.id}>
            {source.title} · {source.type}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {record.projectId === null ? null : (
        <AppLink
          className="text-sm underline"
          href={`/projects/${encodeURIComponent(record.projectId)}#technical-diagrams`}
        >
          Technical Diagrams
        </AppLink>
      )}
      {selectedDiagramId ? (
        <>
          <Label htmlFor="document-live-diagram-view">Diagram View</Label>
          <NativeSelect
            id="document-live-diagram-view"
            onChange={(event) => {
              const viewId = event.target.value;
              if (viewId) {
                const spacer = field.state.value.trimEnd() ? "\n\n" : "";
                field.handleChange(
                  `${field.state.value.trimEnd()}${spacer}:::live-diagram{diagramId="${selectedDiagramId}" viewId="${viewId}"}\n`,
                );
              }
            }}
            value=""
          >
            <NativeSelectOption value="">Diagram View</NativeSelectOption>
            {diagramViews.data?.map((diagramView) => (
              <NativeSelectOption key={diagramView.id} value={diagramView.id}>
                {diagramView.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Label htmlFor="document-live-diagram-version">Diagram Version</Label>
          <NativeSelect
            id="document-live-diagram-version"
            onChange={(event) => {
              const versionId = event.target.value;
              if (versionId) {
                const spacer = field.state.value.trimEnd() ? "\n\n" : "";
                field.handleChange(
                  `${field.state.value.trimEnd()}${spacer}:::live-diagram{diagramId="${selectedDiagramId}" versionId="${versionId}"}\n`,
                );
              }
            }}
            value=""
          >
            <NativeSelectOption value="">
              Pin exact Diagram Version
            </NativeSelectOption>
            {diagramVersions.data?.map((version) => (
              <NativeSelectOption key={version.id} value={version.id}>
                {version.name} · v{version.number}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </>
      ) : null}
      <Label htmlFor="document-record-reference">Record reference</Label>
      <NativeSelect
        id="document-record-reference"
        onChange={(event) => setRecordReferenceChoice(event.target.value)}
        value={recordReferenceChoice}
      >
        <NativeSelectOption value="">Choose a record</NativeSelectOption>
        {recordReferenceOptions.map((candidate) => (
          <NativeSelectOption
            key={`${candidate.recordType}:${candidate.id}`}
            value={`${candidate.recordType}:${candidate.id}`}
          >
            {candidate.recordType} · {candidate.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button
        disabled={!recordReferenceChoice}
        onClick={() => {
          const reference = recordReferenceOptions.find(
            ({ id, recordType }) =>
              `${recordType}:${id}` === recordReferenceChoice,
          );
          if (!reference) {
            return;
          }
          const label = reference.label
            .replaceAll("|", " ")
            .replaceAll("]", " ");
          const token = `[[record:${reference.recordType}:${reference.id}|${label}]]`;
          const spacer = field.state.value.trimEnd() ? "\n\n" : "";
          field.handleChange(
            `${field.state.value.trimEnd()}${spacer}${token}\n`,
          );
          setRecordReferenceChoice("");
        }}
        type="button"
        variant="outline"
      >
        Insert record reference
      </Button>
      <Label htmlFor="document-markdown">Markdown source</Label>
      <Textarea
        className="field-sizing-fixed min-h-80 w-full resize-y rounded-lg border border-border bg-background p-5 font-mono text-sm leading-6 focus-visible:outline-2 focus-visible:outline-ring"
        id="document-markdown"
        onChange={(event) => {
          field.handleChange(event.target.value);
          setSelectedTextRange({
            start: event.target.selectionStart,
            end: event.target.selectionEnd,
          });
          setConversionWarning(false);
        }}
        onSelect={(event) => {
          const nextSelection = {
            start: event.currentTarget.selectionStart,
            end: event.currentTarget.selectionEnd,
          };
          if (
            nextSelection.start !== selectedTextRange?.start ||
            nextSelection.end !== selectedTextRange?.end
          ) {
            pinEvidenceKey.current = null;
          }
          setSelectedTextRange(nextSelection);
        }}
        value={field.state.value}
      />
      <Button
        disabled={
          !selectedTextRange ||
          selectedTextRange.end <= selectedTextRange.start ||
          field.state.value !== savedBody
        }
        onClick={() => setPinEvidenceOpen(true)}
        type="button"
        variant="outline"
      >
        Version-pinned evidence
      </Button>
      <Button
        disabled={
          record.projectId === null ||
          !selectedTextRange ||
          selectedTextRange.end <= selectedTextRange.start ||
          field.state.value !== savedBody
        }
        onClick={() => {
          if (!selectedTextRange) {
            return;
          }
          recordConversionKey.current = null;
          recordConversionId.current = null;
          setRecordConversionOpen(true);
        }}
        type="button"
        variant="outline"
      >
        Convert to record
      </Button>
      <Button
        disabled={
          record.projectId === null ||
          bulkRows.length === 0 ||
          field.state.value !== savedBody
        }
        onClick={() => {
          setBulkConversionOpen(true);
        }}
        type="button"
        variant="outline"
      >
        Convert in bulk
      </Button>
    </div>
  );
}
