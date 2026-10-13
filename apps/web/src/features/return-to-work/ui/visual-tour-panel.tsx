import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { ReturnVisualTourState } from "@cantiara/api/return-visual-tour";
import { Button } from "@cantiara/ui/components/button";
import { formatAccountDateTime } from "../../account-preferences/lib/account-preferences-format";

const SKIP_EXPLANATIONS = {
  deleted: "Skipped: this target was deleted.",
  inaccessible: "Skipped: this target is inaccessible.",
  unplaceable: "Skipped: this target cannot be placed in the current view.",
};

export default function VisualTourPanel({
  state,
  onNext,
  onClose,
  onRemainder,
  preferences = DEFAULT_ACCOUNT_PREFERENCES,
}: {
  state: ReturnVisualTourState;
  onNext: () => void;
  onClose: () => void;
  onRemainder: () => void;
  preferences?: AccountPreferences;
}) {
  const { current } = state;
  return (
    <div className="space-y-3">
      <div aria-atomic="true" aria-live="polite" className="space-y-1">
        <p className="text-muted-foreground text-sm">
          Up to {state.limit} visual changes · {state.position} of {state.total}
        </p>
        {state.status === "loading" && (
          <p role="status">Loading visual change…</p>
        )}
        {state.status === "complete" && <p>Tour complete.</p>}
        {current !== null && (
          <>
            <p className="break-words font-medium">
              {current.event.source.title}
            </p>
            <p className="text-sm">
              {current.event.kind} since your last visit.
            </p>
            <time
              className="text-muted-foreground text-sm"
              dateTime={current.event.occurredAt}
            >
              {formatAccountDateTime(current.event.occurredAt, preferences)}
            </time>
            {current.outcome.status === "skipped" && (
              <p className="text-sm">
                {SKIP_EXPLANATIONS[current.outcome.reason]}
              </p>
            )}
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={state.status !== "showing"}
          onClick={onNext}
          type="button"
        >
          Next change
        </Button>
        <Button onClick={onClose} type="button" variant="outline">
          Close tour
        </Button>
      </div>
      {state.remainder !== null && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm">{state.remainder.count} more visual changes</p>
          <Button onClick={onRemainder} type="button" variant="outline">
            Open remaining changes in list
          </Button>
        </div>
      )}
    </div>
  );
}
