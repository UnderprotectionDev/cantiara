// biome-ignore-all lint/performance/noJsxPropsBind: Controls close over one Work and its previewed trail.

import type {
  WorkNotNowReviewLaterHandling,
  WorkNotNowTrail,
} from "@cantiara/api/work-not-now";
import { Button } from "@cantiara/ui/components/button";
import { useForm } from "@tanstack/react-form";
import { ReviewLaterHandlingField } from "../components/not-now-review-later-field";

export function NotNowReconsideration({
  archived,
  currentTrail,
  canStart,
  workId,
  onReviewLaterHandlingChange,
  reconsiderPending,
  historyPending,
  reviewLaterHandling,
  connection,
  onReconsider,
  onStartNew,
}: {
  archived: boolean;
  currentTrail: WorkNotNowTrail | null;
  canStart: boolean;
  workId: string;
  onReviewLaterHandlingChange: (
    handling: WorkNotNowReviewLaterHandling,
  ) => void;
  reconsiderPending: boolean;
  historyPending: boolean;
  reviewLaterHandling: "Keep Review later" | "Remove Review later";
  connection: string;
  onReconsider: () => void;
  onStartNew: () => void;
}) {
  const form = useForm({
    defaultValues: { reviewLaterHandling },
    onSubmit: () => {
      onReconsider();
    },
  });
  return !archived && (currentTrail || canStart) ? (
    <form
      className="space-y-3 border-t pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      {currentTrail ? (
        <form.Field name="reviewLaterHandling">
          {(field) => (
            <ReviewLaterHandlingField
              name={`not-now-review-later-handling-${workId}`}
              onChange={(handling) => {
                field.handleChange(handling);
                onReviewLaterHandlingChange(handling);
              }}
              pending={reconsiderPending || historyPending}
              value={field.state.value}
            />
          )}
        </form.Field>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {currentTrail ? (
          <Button
            disabled={
              reconsiderPending || historyPending || connection === "offline"
            }
            type="submit"
            variant="outline"
          >
            Reconsidering
          </Button>
        ) : null}
        {canStart ? (
          <Button onClick={onStartNew} type="button">
            Not now
          </Button>
        ) : null}
      </div>
    </form>
  ) : null;
}
