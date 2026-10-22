// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import type { Document } from "@cantiara/api/documents";
import type { client } from "@/utils/orpc";
import DocumentPreview from "./document-preview";

export default function DocumentBodyPreview({
  documentReferences,
  liveOtherBlocks,
  liveWorkBlocks,
  setWorkAction,
  record,
  previewBody,
  savedBody,
  conversionKey,
  setConversionTitle,
  setOriginalBlockOutcome,
  setConversionSelection,
  body,
  targetSectionId,
}: {
  documentReferences: import("@tanstack/react-query").UseQueryResult<
    Awaited<ReturnType<typeof client.documentRecordReferences>>,
    Error
  >;
  liveOtherBlocks: import("@tanstack/react-query").UseQueryResult<
    Awaited<ReturnType<typeof client.documentLiveOtherBlocks>>,
    Error
  >;
  liveWorkBlocks: import("@tanstack/react-query").UseQueryResult<
    {
      workId: string;
      source: import("@cantiara/api/documents").LiveWorkSource | null;
    }[],
    Error
  >;
  setWorkAction: import("react").Dispatch<
    import("react").SetStateAction<{
      id: string;
      kind: "status" | "close";
      requestId: string;
    } | null>
  >;
  record: Document;
  previewBody: string;
  savedBody: string;
  conversionKey: import("react").RefObject<string | null>;
  setConversionTitle: import("react").Dispatch<
    import("react").SetStateAction<string>
  >;
  setOriginalBlockOutcome: import("react").Dispatch<
    import("react").SetStateAction<
      "Keep independent" | "Replace with live reference"
    >
  >;
  setConversionSelection: import("react").Dispatch<
    import("react").SetStateAction<{ start: number; end: number } | null>
  >;
  body: string;
  targetSectionId: string | undefined;
}) {
  return (
    <div className="min-h-80 rounded-lg border border-border bg-background p-5 text-sm leading-7">
      <DocumentPreview
        documentReferences={
          documentReferences.isPending
            ? undefined
            : (documentReferences.data ?? [])
        }
        liveOtherBlocks={
          liveOtherBlocks.isPending ? undefined : (liveOtherBlocks.data ?? [])
        }
        liveWorkBlocks={
          liveWorkBlocks.isPending ? undefined : (liveWorkBlocks.data ?? [])
        }
        onLiveWorkAction={(id, kind) =>
          setWorkAction({
            id,
            kind,
            requestId: crypto.randomUUID(),
          })
        }
        onMermaidConvert={
          record.projectId !== null && previewBody === savedBody
            ? (start, end) => {
                conversionKey.current = null;
                setConversionTitle(record.title);
                setOriginalBlockOutcome("Keep independent");
                setConversionSelection({ start, end });
              }
            : undefined
        }
        source={body}
        targetSectionId={targetSectionId}
      />
    </div>
  );
}
