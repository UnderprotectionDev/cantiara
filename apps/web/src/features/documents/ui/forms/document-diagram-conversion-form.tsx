// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import {
  DialogClose,
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
import { LiteDebouncer } from "@tanstack/pacer-lite";
import { useForm, useSelector } from "@tanstack/react-form";
import {
  skipToken,
  type UseMutationResult,
  useQuery,
} from "@tanstack/react-query";
import { useCreateStore } from "@tanstack/react-store";
import { type RefObject, useEffect, useMemo } from "react";
import { type client, orpc } from "@/utils/orpc";
import { convertMermaidDiagramFormSchema } from "../../lib/document-conversion-form";
import { matchesDiagramConversionPreview } from "../../lib/document-editor-markdown";

export default function DocumentDiagramConversionDialog({
  conversionKey,
  conversionSelection,
  diagramWrite,
  open,
  record,
}: {
  conversionKey: RefObject<string | null>;
  conversionSelection: { start: number; end: number; revision: number };
  diagramWrite: Pick<
    UseMutationResult<
      Awaited<ReturnType<typeof client.convertMermaidToTechnicalDiagram>>,
      Error,
      Parameters<typeof client.convertMermaidToTechnicalDiagram>[0],
      unknown
    >,
    "mutateAsync" | "isPending" | "isError" | "error"
  >;
  open: boolean;
  record: Pick<Document, "id" | "title">;
}) {
  const form = useForm({
    defaultValues: {
      originalBlock: "Keep independent" as
        | "Keep independent"
        | "Replace with live reference",
      title: record.title,
    },
    onSubmit: async ({ value }) => {
      const parsed = convertMermaidDiagramFormSchema.safeParse(value);
      const reviewed = conversionPreview.data;
      if (
        !(
          parsed.success &&
          canConvert &&
          reviewed &&
          parsed.data.title === title &&
          parsed.data.originalBlock === originalBlock
        )
      ) {
        return;
      }
      conversionKey.current ??= crypto.randomUUID();
      await diagramWrite.mutateAsync({
        ...previewSource,
        ...parsed.data,
        previewToken: reviewed.previewToken,
        clientIdempotencyKey: conversionKey.current,
      });
    },
  });
  const title = useSelector(form.store, (state) => state.values.title.trim());
  const originalBlock = useSelector(
    form.store,
    (state) => state.values.originalBlock,
  );
  const previewTitle = useCreateStore(record.title.trim());
  const settledTitle = useSelector(previewTitle, (value) => value);
  const debouncer = useMemo(
    () =>
      new LiteDebouncer((next: string) => previewTitle.setState(() => next), {
        wait: 250,
      }),
    [previewTitle],
  );
  useEffect(() => {
    if (open && title !== settledTitle) {
      debouncer.maybeExecute(title);
    }
    return () => debouncer.cancel();
  }, [debouncer, open, title, settledTitle]);

  const previewSource = {
    documentId: record.id,
    documentRevision: conversionSelection.revision,
    blockStart: conversionSelection.start,
    blockEnd: conversionSelection.end,
  };
  const ready =
    open &&
    title === settledTitle &&
    convertMermaidDiagramFormSchema.shape.title.safeParse(title).success;
  const conversionPreview = useQuery(
    orpc.previewMermaidConversion.queryOptions({
      input: ready ? { ...previewSource, originalBlock, title } : skipToken,
    }),
  );
  const previewMatchesSelection =
    ready &&
    conversionPreview.isSuccess &&
    !conversionPreview.isFetching &&
    matchesDiagramConversionPreview(
      conversionPreview.data,
      conversionSelection,
      title,
      originalBlock,
    );
  const canConvert =
    previewMatchesSelection &&
    Boolean(conversionPreview.data?.canConvert) &&
    !diagramWrite.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Convert to Technical Diagram</DialogTitle>
        <DialogDescription>Imported Independent Copy</DialogDescription>
      </DialogHeader>
      <form
        aria-label="Convert to Technical Diagram"
        className="space-y-2"
        id="convert-diagram-form"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit().catch(() => undefined);
        }}
      >
        <form.Field
          listeners={{
            onChange: ({ value }) => {
              if (value.trim() !== title) {
                conversionKey.current = null;
              }
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
            onChange: () => {
              conversionKey.current = null;
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
        {conversionPreview.data && previewMatchesSelection ? (
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
        {ready && conversionPreview.isError ? (
          <p role="alert">{conversionPreview.error.message}</p>
        ) : null}
        {diagramWrite.isError ? (
          <p role="alert">{diagramWrite.error?.message}</p>
        ) : null}
      </form>
      <DialogFooter>
        <DialogClose
          disabled={diagramWrite.isPending}
          render={<Button variant="outline" />}
        >
          Cancel
        </DialogClose>
        <Button
          disabled={!canConvert}
          form="convert-diagram-form"
          type="submit"
        >
          Convert to Technical Diagram
        </Button>
      </DialogFooter>
    </>
  );
}
