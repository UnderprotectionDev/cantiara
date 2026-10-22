// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import type { DocumentEvidenceTargetType } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { client } from "@/utils/orpc";
import { pinDocumentEvidenceFormSchema } from "../../lib/document-conversion-form";

export default function DocumentEvidenceDialog({
  setPinEvidenceOpen,
  pinEvidenceOpen,
  selectedTextRange,
  form,
  pinEvidenceKey,
  recordReferenceOptions,
  pinEvidence,
}: {
  setPinEvidenceOpen: import("react").Dispatch<
    import("react").SetStateAction<boolean>
  >;
  pinEvidenceOpen: boolean;
  selectedTextRange: { end: number; start: number } | null;
  form: {
    getFieldValue: (name: "body") => string;
    state: { isDirty: boolean };
  };
  pinEvidenceKey: import("react").RefObject<string | null>;
  recordReferenceOptions: { id: string; label: string; recordType: string }[];
  pinEvidence: import("@tanstack/react-query").UseMutationResult<
    Awaited<ReturnType<typeof client.pinDocumentEvidence>>,
    Error,
    { targetRecordId: string; targetRecordType: DocumentEvidenceTargetType },
    unknown
  >;
}) {
  return (
    <Dialog
      onOpenChange={(open) => {
        setPinEvidenceOpen(open);
      }}
      open={pinEvidenceOpen}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Version-pinned evidence</DialogTitle>
          <DialogDescription>
            {selectedTextRange
              ? form
                  .getFieldValue("body")
                  .slice(selectedTextRange.start, selectedTextRange.end)
              : "Select text in the saved Document."}
          </DialogDescription>
        </DialogHeader>
        <DocumentEvidenceForm
          onCancel={() => setPinEvidenceOpen(false)}
          pinEvidence={pinEvidence}
          pinEvidenceKey={pinEvidenceKey}
          recordReferenceOptions={recordReferenceOptions}
        />
      </DialogContent>
    </Dialog>
  );
}

function DocumentEvidenceForm({
  onCancel,
  pinEvidence,
  pinEvidenceKey,
  recordReferenceOptions,
}: {
  onCancel: () => void;
  pinEvidence: import("@tanstack/react-query").UseMutationResult<
    Awaited<ReturnType<typeof client.pinDocumentEvidence>>,
    Error,
    { targetRecordId: string; targetRecordType: DocumentEvidenceTargetType },
    unknown
  >;
  pinEvidenceKey: import("react").RefObject<string | null>;
  recordReferenceOptions: { id: string; label: string; recordType: string }[];
}) {
  const evidenceForm = useForm({
    defaultValues: {
      targetRecordId: "",
      targetRecordType: "Work" as DocumentEvidenceTargetType,
    },
    onSubmit: ({ value }) => {
      const parsed = pinDocumentEvidenceFormSchema.safeParse(value);
      if (parsed.success) {
        pinEvidence.mutate(parsed.data);
      }
    },
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        evidenceForm.handleSubmit().catch(() => undefined);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="document-evidence-target-type">Record type</Label>
        <evidenceForm.Field name="targetRecordType">
          {(field) => (
            <NativeSelect
              id="document-evidence-target-type"
              name={field.name}
              onChange={(event) => {
                field.handleChange(
                  event.target.value as DocumentEvidenceTargetType,
                );
                evidenceForm.setFieldValue("targetRecordId", "");
                pinEvidenceKey.current = null;
              }}
              value={field.state.value}
            >
              <NativeSelectOption value="Work">Work</NativeSelectOption>
              <NativeSelectOption value="Document">Document</NativeSelectOption>
              <NativeSelectOption value="Technical Diagram">
                Technical Diagram
              </NativeSelectOption>
              <NativeSelectOption value="Decision">Decision</NativeSelectOption>
              <NativeSelectOption value="Risk">Risk</NativeSelectOption>
              <NativeSelectOption value="Assumption">
                Assumption
              </NativeSelectOption>
              <NativeSelectOption value="Open Question">
                Open Question
              </NativeSelectOption>
              <NativeSelectOption value="Milestone">
                Milestone
              </NativeSelectOption>
              <NativeSelectOption value="Project Release">
                Project Release
              </NativeSelectOption>
              <NativeSelectOption value="Production Incident">
                Production Incident
              </NativeSelectOption>
            </NativeSelect>
          )}
        </evidenceForm.Field>
        <Label htmlFor="document-evidence-target">Existing record</Label>
        <evidenceForm.Subscribe
          selector={(state) => state.values.targetRecordType}
        >
          {(targetRecordType) => (
            <evidenceForm.Field name="targetRecordId">
              {(field) => (
                <NativeSelect
                  id="document-evidence-target"
                  name={field.name}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    pinEvidenceKey.current = null;
                  }}
                  value={field.state.value}
                >
                  <NativeSelectOption value="">
                    Choose a record
                  </NativeSelectOption>
                  {recordReferenceOptions
                    .filter(
                      (candidate) => candidate.recordType === targetRecordType,
                    )
                    .map((candidate) => (
                      <NativeSelectOption
                        key={candidate.id}
                        value={candidate.id}
                      >
                        {candidate.label}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              )}
            </evidenceForm.Field>
          )}
        </evidenceForm.Subscribe>
        {pinEvidence.isError ? (
          <p role="alert">{pinEvidence.error.message}</p>
        ) : null}
      </div>
      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <evidenceForm.Subscribe
          selector={(state) => state.values.targetRecordId}
        >
          {(targetRecordId) => (
            <Button
              disabled={!targetRecordId || pinEvidence.isPending}
              type="submit"
            >
              Version-pinned evidence
            </Button>
          )}
        </evidenceForm.Subscribe>
      </DialogFooter>
    </form>
  );
}
