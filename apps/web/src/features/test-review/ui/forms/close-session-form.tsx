// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the session and item being reviewed.
import type { TestReviewClosePreview } from "@cantiara/api/test-review";
import { Button } from "@cantiara/ui/components/button";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";
import { usePanelFocus } from "../../hooks/use-panel-focus";
import { closeSessionFormSchema } from "../../lib/test-review-forms";

export default function CloseSessionForm({
  onCancel,
  onConfirm,
  pending,
  preview,
}: {
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
  preview: TestReviewClosePreview;
}) {
  const form = useForm({
    defaultValues: { reason: "" },
    onSubmit: ({ value }) => {
      const parsed = closeSessionFormSchema.safeParse(value);
      if (parsed.success) {
        onConfirm(parsed.data.reason);
      }
    },
  });
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  const headingRef = usePanelFocus(true);
  return (
    <section
      aria-labelledby="test-review-close-heading"
      className="space-y-3 rounded-md border border-border p-3 text-sm"
    >
      <h5
        className="font-medium outline-none"
        id="test-review-close-heading"
        ref={headingRef}
        tabIndex={-1}
      >
        Close this Test Session
      </h5>
      {preview.remaining.length === 0 ? (
        <p>Every Session Test has been reviewed or closed.</p>
      ) : (
        <>
          <p>
            These Session Tests stay exactly as they are. Closing is not blocked
            by them.
          </p>
          <ul aria-label="Remaining Session Tests" className="list-disc pl-5">
            {preview.remaining.map((record) => (
              <li key={record.id}>{`${record.title}: ${record.state}`}</li>
            ))}
          </ul>
        </>
      )}
      <form onSubmit={handleSubmit}>
        <form.Field name="reason">
          {(field) => (
            <div className="grid gap-2">
              <label htmlFor="test-review-close-reason">
                Close reason (optional)
              </label>
              <Textarea
                disabled={pending}
                id="test-review-close-reason"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                rows={2}
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
        <div className="mt-3 flex gap-2">
          <Button disabled={pending} type="submit">
            Close Test Session
          </Button>
          <Button
            disabled={pending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
