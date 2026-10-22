// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import type { Document } from "@cantiara/api/documents";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { useForm } from "@tanstack/react-form";
import { convertDocumentListToWorkFormSchema } from "../../lib/document-conversion-form";
import {
  type DocumentListRow,
  titleFromSelectedText,
} from "../../lib/document-editor-markdown";

export default function DocumentBulkConversionDialog({
  convertListToWork,
  setBulkConversionOpen,
  bulkConversionOpen,
  record,
  revision,
  bulkRows,
  bulkConversionKey,
}: {
  convertListToWork: import("@tanstack/react-query").UseMutationResult<
    WorkProfile[],
    Error,
    string[],
    unknown
  >;
  setBulkConversionOpen: import("react").Dispatch<
    import("react").SetStateAction<boolean>
  >;
  bulkConversionOpen: boolean;
  record: Document;
  revision: number;
  bulkRows: DocumentListRow[];
  bulkConversionKey: import("react").RefObject<string | null>;
}) {
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && convertListToWork.isPending) {
          return;
        }
        setBulkConversionOpen(open);
      }}
      open={bulkConversionOpen}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Convert in bulk</DialogTitle>
          <DialogDescription>
            Choose saved list rows to create as Work. All selected rows and
            their version-pinned evidence are committed together.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border p-3 text-sm">
          <p>Project: {record.projectId}</p>
          <p>
            Document: {record.title} · Version {revision}
          </p>
          <p>Record type: Task</p>
        </div>
        <DocumentBulkConversionForm
          bulkConversionKey={bulkConversionKey}
          bulkRows={bulkRows}
          convertListToWork={convertListToWork}
          onCancel={() => setBulkConversionOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function DocumentBulkConversionForm({
  bulkConversionKey,
  bulkRows,
  convertListToWork,
  onCancel,
}: {
  bulkConversionKey: import("react").RefObject<string | null>;
  bulkRows: DocumentListRow[];
  convertListToWork: import("@tanstack/react-query").UseMutationResult<
    WorkProfile[],
    Error,
    string[],
    unknown
  >;
  onCancel: () => void;
}) {
  const bulkForm = useForm({
    defaultValues: { selectedKeys: [] as string[] },
    onSubmit: ({ value }) => {
      const parsed = convertDocumentListToWorkFormSchema.safeParse(value);
      if (parsed.success) {
        convertListToWork.mutate(parsed.data.selectedKeys);
      }
    },
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        bulkForm.handleSubmit().catch(() => undefined);
      }}
    >
      <bulkForm.Field name="selectedKeys">
        {(field) => (
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-3">
            {bulkRows.map((row) => {
              const key = `${row.start}:${row.end}`;
              const checked = field.state.value.includes(key);
              return (
                <div
                  className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/50"
                  key={key}
                >
                  <Checkbox
                    aria-label={titleFromSelectedText(row.text)}
                    checked={checked}
                    disabled={convertListToWork.isPending}
                    onCheckedChange={(value) => {
                      field.handleChange(
                        value === true
                          ? [...field.state.value, key]
                          : field.state.value.filter(
                              (candidate) => candidate !== key,
                            ),
                      );
                      bulkConversionKey.current = null;
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {titleFromSelectedText(row.text)}
                    </span>
                    <span className="block whitespace-pre-wrap text-muted-foreground">
                      {row.text}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </bulkForm.Field>
      {convertListToWork.isError ? (
        <p role="alert">{convertListToWork.error.message}</p>
      ) : null}
      <DialogFooter>
        <Button
          disabled={convertListToWork.isPending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <bulkForm.Subscribe selector={(state) => state.values.selectedKeys}>
          {(selectedKeys) => (
            <Button
              disabled={
                !bulkRows.some(({ start, end }) =>
                  selectedKeys.includes(`${start}:${end}`),
                ) || convertListToWork.isPending
              }
              type="submit"
            >
              Convert in bulk
            </Button>
          )}
        </bulkForm.Subscribe>
      </DialogFooter>
    </form>
  );
}
