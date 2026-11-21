// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import {
  type createDialogHandle,
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
import {
  convertDocumentTextToRecordFormSchema,
  DOCUMENT_CONVERSION_RECORD_TYPES,
  type DocumentConversionRecordType,
} from "../../lib/document-conversion-form";
import { titleFromSelectedText } from "../../lib/document-editor-markdown";

const DOCUMENT_CONVERSION_CONTENT_FIELDS = {
  Work: "Description",
  Decision: "Decision text",
  Risk: "Description",
  Assumption: "Statement",
  "Open Question": "Question",
} as const;

export default function DocumentRecordConversionDialog({
  recordConversionHandle,
  recordConversionKey,
  recordConversionId,
  record,
  revision,
  selectedTextRange,
  form,
  convertSelectedText,
}: {
  recordConversionHandle: ReturnType<typeof createDialogHandle>;
  recordConversionKey: import("react").RefObject<string | null>;
  recordConversionId: import("react").RefObject<string | null>;
  record: Document;
  revision: number;
  selectedTextRange: { end: number; start: number } | null;
  form: {
    getFieldValue: (name: "body") => string;
    state: { isDirty: boolean };
  };
  convertSelectedText: Pick<
    import("@tanstack/react-query").UseMutationResult<
      void,
      Error,
      { recordType: DocumentConversionRecordType; title: string },
      unknown
    >,
    "mutateAsync" | "isPending" | "isError" | "error"
  >;
}) {
  const selectedText = selectedTextRange
    ? form
        .getFieldValue("body")
        .slice(selectedTextRange.start, selectedTextRange.end)
    : "";
  return (
    <Dialog
      handle={recordConversionHandle}
      onOpenChange={(open, event) => {
        if (
          !open &&
          convertSelectedText.isPending &&
          event.reason !== "imperative-action"
        ) {
          event.cancel();
          return;
        }
        if (!open) {
          recordConversionKey.current = null;
          recordConversionId.current = null;
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to record</DialogTitle>
          <DialogDescription>
            Create one record with version-pinned evidence from the selected
            Document text.
          </DialogDescription>
        </DialogHeader>
        <DocumentRecordConversionForm
          convertSelectedText={convertSelectedText}
          initialTitle={titleFromSelectedText(selectedText)}
          onCancel={() => {
            if (!convertSelectedText.isPending) {
              recordConversionHandle.close();
            }
          }}
          record={record}
          recordConversionId={recordConversionId}
          recordConversionKey={recordConversionKey}
          revision={revision}
          selectedText={selectedTextRange ? selectedText : null}
        />
      </DialogContent>
    </Dialog>
  );
}

function DocumentRecordConversionForm({
  convertSelectedText,
  initialTitle,
  onCancel,
  record,
  recordConversionId,
  recordConversionKey,
  revision,
  selectedText,
}: {
  convertSelectedText: Pick<
    import("@tanstack/react-query").UseMutationResult<
      void,
      Error,
      { recordType: DocumentConversionRecordType; title: string },
      unknown
    >,
    "mutateAsync" | "isPending" | "isError" | "error"
  >;
  initialTitle: string;
  onCancel: () => void;
  record: Document;
  recordConversionId: import("react").RefObject<string | null>;
  recordConversionKey: import("react").RefObject<string | null>;
  revision: number;
  selectedText: string | null;
}) {
  const conversionForm = useForm({
    defaultValues: {
      recordType: "Work" as DocumentConversionRecordType,
      title: initialTitle,
    },
    onSubmit: async ({ value }) => {
      const parsed = convertDocumentTextToRecordFormSchema.safeParse(value);
      if (parsed.success) {
        await convertSelectedText.mutateAsync(parsed.data);
      }
    },
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        conversionForm.handleSubmit().catch(() => undefined);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="document-conversion-type">Record type</Label>
        <conversionForm.Field name="recordType">
          {(field) => (
            <NativeSelect
              id="document-conversion-type"
              name={field.name}
              onChange={(event) => {
                field.handleChange(
                  event.target.value as DocumentConversionRecordType,
                );
                recordConversionKey.current = null;
                recordConversionId.current = null;
              }}
              value={field.state.value}
            >
              {DOCUMENT_CONVERSION_RECORD_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {type}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </conversionForm.Field>
        <Label htmlFor="document-conversion-title">Title</Label>
        <conversionForm.Field name="title">
          {(field) => (
            <Input
              id="document-conversion-title"
              name={field.name}
              onChange={(event) => {
                field.handleChange(event.target.value);
                recordConversionKey.current = null;
                recordConversionId.current = null;
              }}
              value={field.state.value}
            />
          )}
        </conversionForm.Field>
        <div className="rounded-md border p-3 text-sm">
          <p>Project: {record.projectId}</p>
          <p>
            Document: {record.title} · Version {revision}
          </p>
          <conversionForm.Subscribe
            selector={(state) => state.values.recordType}
          >
            {(recordType) => (
              <>
                <p>Type: {recordType}</p>
                <p>
                  Content field:{" "}
                  {DOCUMENT_CONVERSION_CONTENT_FIELDS[recordType]}
                </p>
              </>
            )}
          </conversionForm.Subscribe>
          <p>Evidence: selected text · version-pinned</p>
          <p className="mt-2 whitespace-pre-wrap">
            {selectedText ?? "No text selected."}
          </p>
        </div>
        {convertSelectedText.isError ? (
          <p role="alert">{convertSelectedText.error?.message}</p>
        ) : null}
      </div>
      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <conversionForm.Subscribe selector={(state) => state.values.title}>
          {(title) => (
            <Button
              disabled={!title.trim() || convertSelectedText.isPending}
              type="submit"
            >
              Convert to record
            </Button>
          )}
        </conversionForm.Subscribe>
      </DialogFooter>
    </form>
  );
}
