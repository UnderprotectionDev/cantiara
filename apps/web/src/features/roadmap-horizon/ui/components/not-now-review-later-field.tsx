// biome-ignore-all lint/performance/noJsxPropsBind: Controls close over one Work and its previewed trail.

import type { WorkNotNowReviewLaterHandling } from "@cantiara/api/work-not-now";
import {
  RadioGroup,
  RadioGroupItem,
} from "@cantiara/ui/components/radio-group";

export function reviewLaterHandlingPreview(
  handling: WorkNotNowReviewLaterHandling,
) {
  return handling === "Keep Review later"
    ? "Planned Review Later reminders will stay scheduled."
    : "Planned Review Later reminders for this Work will be cancelled.";
}

const REVIEW_LATER_HANDLING_OPTIONS = [
  ["Keep Review later", "Leave planned Review Later reminders scheduled."],
  [
    "Remove Review later",
    "Cancel planned Review Later reminders for this Work.",
  ],
] as const;

export function ReviewLaterHandlingField({
  name,
  onChange,
  pending,
  value,
}: {
  name: string;
  onChange: (handling: WorkNotNowReviewLaterHandling) => void;
  pending: boolean;
  value: WorkNotNowReviewLaterHandling;
}) {
  return (
    <fieldset className="space-y-2" disabled={pending}>
      <legend className="font-medium text-xs">Review Later reminders</legend>
      <RadioGroup
        name={name}
        onValueChange={(next) => {
          const handling = REVIEW_LATER_HANDLING_OPTIONS.find(
            ([option]) => option === next,
          );
          if (handling) {
            onChange(handling[0]);
          }
        }}
        value={value}
      >
        {REVIEW_LATER_HANDLING_OPTIONS.map(([handling, description]) => (
          <label
            className="flex items-start gap-2 rounded-md border border-border/70 px-3 py-2 text-xs"
            htmlFor={`${name}-${handling}`.replaceAll(" ", "-")}
            key={handling}
          >
            <RadioGroupItem
              id={`${name}-${handling}`.replaceAll(" ", "-")}
              value={handling}
            />
            <span>
              <span className="block font-medium">{handling}</span>
              <span className="text-muted-foreground">{description}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
      <p aria-live="polite" className="text-muted-foreground text-xs">
        Preview: {reviewLaterHandlingPreview(value)}
      </p>
    </fieldset>
  );
}
