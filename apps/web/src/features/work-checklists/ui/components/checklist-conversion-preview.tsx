import type { WorkChecklistConversionPreview } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";

export function ChecklistConversionPreview({
  preview,
  pending,
  disabled,
  onConfirm,
  onCancel,
}: {
  preview: WorkChecklistConversionPreview;
  pending: boolean;
  disabled: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <section
      aria-label="Convert to independent Work"
      className="basis-full space-y-2 rounded-md border border-primary/25 bg-primary/5 p-3 text-xs"
      role="status"
    >
      <p className="font-medium text-sm">Convert to independent Work</p>
      <p>
        Title: <strong>{preview.newWork.title}</strong>
      </p>
      <p>
        Project: <strong>{preview.targetProject.name}</strong>
      </p>
      <p>
        Start status: <strong>{preview.newWork.status}</strong>
      </p>
      <p>
        Origin: {preview.sourceWork.key} — {preview.sourceWork.title}
      </p>
      <p className="text-muted-foreground">
        Origin Location: {preview.originPosition.ownerRecordId} /{" "}
        {preview.originPosition.componentId} /{" "}
        {preview.originPosition.sourceVersion ?? "Unknown"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={disabled || pending}
          onClick={onConfirm}
          size="xs"
          type="button"
        >
          Confirm convert
        </Button>
        <Button
          disabled={pending}
          onClick={onCancel}
          size="xs"
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </section>
  );
}
