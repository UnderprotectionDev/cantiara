// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import type { client } from "@/utils/orpc";
import { matchesDiagramConversionPreview } from "../../lib/document-editor-markdown";

export default function DocumentDiagramConversionDialog({
  setConversionSelection,
  conversionKey,
  setOriginalBlockOutcome,
  conversionSelection,
  conversionTitle,
  setConversionTitle,
  originalBlockOutcome,
  conversionPreview,
  record,
  convertDiagram,
}: {
  setConversionSelection: import("react").Dispatch<
    import("react").SetStateAction<{ start: number; end: number } | null>
  >;
  conversionKey: import("react").RefObject<string | null>;
  setOriginalBlockOutcome: import("react").Dispatch<
    import("react").SetStateAction<
      "Keep independent" | "Replace with live reference"
    >
  >;
  conversionSelection: { start: number; end: number } | null;
  conversionTitle: string;
  setConversionTitle: import("react").Dispatch<
    import("react").SetStateAction<string>
  >;
  originalBlockOutcome: "Keep independent" | "Replace with live reference";
  conversionPreview: import("@tanstack/react-query").UseQueryResult<
    Awaited<ReturnType<typeof client.previewMermaidConversion>>,
    Error
  >;
  record: Document;
  convertDiagram: import("@tanstack/react-query").UseMutationResult<
    import("@cantiara/api/technical-diagrams").TechnicalDiagramSource,
    Error,
    void,
    unknown
  >;
}) {
  const form = useForm({
    defaultValues: {
      originalBlock: originalBlockOutcome,
      title: conversionTitle,
    },
  });
  // The parent resets the title and outcome when a selection opens or closes.
  useEffect(() => {
    if (form.getFieldValue("title") !== conversionTitle) {
      form.setFieldValue("title", conversionTitle);
    }
    if (form.getFieldValue("originalBlock") !== originalBlockOutcome) {
      form.setFieldValue("originalBlock", originalBlockOutcome);
    }
  }, [conversionTitle, form, originalBlockOutcome]);
  const previewMatchesSelection = matchesDiagramConversionPreview(
    conversionPreview.data,
    conversionSelection,
    conversionTitle,
    originalBlockOutcome,
  );
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setConversionSelection(null);
          conversionKey.current = null;
          setOriginalBlockOutcome("Keep independent");
        }
      }}
      open={conversionSelection !== null}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to Technical Diagram</DialogTitle>
          <DialogDescription>Imported Independent Copy</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <form.Field
            listeners={{
              onChange: ({ value }) => {
                if (value !== conversionTitle) {
                  conversionKey.current = null;
                }
                setConversionTitle(value);
              },
            }}
            name="title"
          >
            {(field) => (
              <>
                <Label htmlFor="converted-diagram-title">Title</Label>
                <Input
                  id="converted-diagram-title"
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </>
            )}
          </form.Field>
          <form.Field
            listeners={{
              onChange: ({ value }) => {
                conversionKey.current = null;
                setOriginalBlockOutcome(value);
              },
            }}
            name="originalBlock"
          >
            {(field) => (
              <>
                <Label htmlFor="converted-diagram-original-block">
                  Original Mermaid block
                </Label>
                <NativeSelect
                  id="converted-diagram-original-block"
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value as
                        | "Keep independent"
                        | "Replace with live reference",
                    )
                  }
                  value={field.state.value}
                >
                  <NativeSelectOption value="Keep independent">
                    Keep independent
                  </NativeSelectOption>
                  <NativeSelectOption value="Replace with live reference">
                    Replace with live reference
                  </NativeSelectOption>
                </NativeSelect>
              </>
            )}
          </form.Field>
          {conversionPreview.data &&
          !conversionPreview.isFetching &&
          previewMatchesSelection ? (
            <section aria-label="Conversion preview" className="text-sm">
              <p>
                Document: {record.title} · Version:{" "}
                {conversionPreview.data.documentRevision}
              </p>
              <p>Technical Architecture · Imported Independent Copy</p>
              <p>
                Mermaid block: line {conversionPreview.data.source.blockLine} ·
                offsets {conversionPreview.data.blockStart}–
                {conversionPreview.data.blockEnd}
              </p>
              <p>{conversionPreview.data.originRelation}</p>
              <p>
                Original Mermaid block: {conversionPreview.data.originalBlock}.{" "}
                {conversionPreview.data.blockEffect}
              </p>
              <p>No live round-trip: later edits never sync back.</p>
              <p>
                {conversionPreview.data.model.nodes.length} nodes ·{" "}
                {conversionPreview.data.model.links.length} links
              </p>
              {conversionPreview.data.unparseableLines.length > 0 ? (
                <div>
                  <p>Unparseable items (left out of the diagram)</p>
                  <ul className="list-inside list-disc">
                    {conversionPreview.data.unparseableLines.map((line) => (
                      <li key={`${line.line}-${line.text}`}>
                        Line {line.line}: {line.text || line.reason} —{" "}
                        {line.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}
          {conversionPreview.isError ? (
            <p role="alert">{conversionPreview.error.message}</p>
          ) : null}
          {convertDiagram.isError ? (
            <p role="alert">{convertDiagram.error.message}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            onClick={() => setConversionSelection(null)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={
              !conversionPreview.data?.canConvert ||
              conversionPreview.isFetching ||
              !previewMatchesSelection ||
              convertDiagram.isPending
            }
            onClick={() => convertDiagram.mutate()}
            type="button"
          >
            Convert to Technical Diagram
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
