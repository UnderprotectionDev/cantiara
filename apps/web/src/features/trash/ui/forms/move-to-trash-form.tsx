// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import {
  KEEP_APPROVED_SURFACE_LABEL,
  MOVE_TO_TRASH_LABEL,
  type MoveToTrashPreview,
  TRASH_LABEL,
  type TrashSurfaceDisposition,
  trashSurfaceDispositionSchema,
} from "@cantiara/api/trash";
import { Button } from "@cantiara/ui/components/button";
import {
  RadioGroup,
  RadioGroupItem,
} from "@cantiara/ui/components/radio-group";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useEffect, useRef } from "react";
import type { TrashCandidate } from "../../lib/trash-candidates";
import { TrashConfigurationImpactList } from "../components/trash-configuration-impact";

/**
 * The `Move to Trash` preview: every attached External Surface is listed
 * before the commit, revoking them is the preselected choice, and `Keep
 * approved surface` is a second choice shown only when the preview says it is
 * available. Keyboard and screen reader users reach both choices through the
 * radio group; focus lands on the heading when the review opens and Escape
 * cancels.
 */
export function MoveToTrashForm({
  candidate,
  disabled,
  onCancel,
  onConfirm,
  preview,
}: {
  candidate: TrashCandidate;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: (disposition: TrashSurfaceDisposition) => void;
  preview: MoveToTrashPreview;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const hasActive = preview.surfaces.some(({ state }) => state === "Active");
  const form = useForm({
    defaultValues: { disposition: "revoke" as TrashSurfaceDisposition },
    onSubmit: ({ value }) => {
      const parsed = trashSurfaceDispositionSchema.safeParse(value.disposition);
      // An unavailable keep never leaves the form: revoke is the safe default.
      onConfirm(
        parsed.success &&
          (parsed.data === "revoke" || preview.keepApprovedSurface.available)
          ? parsed.data
          : "revoke",
      );
    },
  });

  useEffect(() => {
    heading.current?.focus();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape cancels the review for keyboard users.
    <form
      aria-labelledby="move-to-trash-review-title"
      className="space-y-3 rounded-lg border border-border/70 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancel();
        }
      }}
      onSubmit={submit}
    >
      <h4
        className="font-medium"
        id="move-to-trash-review-title"
        ref={heading}
        tabIndex={-1}
      >
        {MOVE_TO_TRASH_LABEL}: {candidate.label}
      </h4>
      {preview.surfaces.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No External Surface is attached to this record.
        </p>
      ) : (
        <>
          <p className="text-sm">
            These External Surfaces are attached to this record.
          </p>
          <ul aria-label="Attached External Surfaces" className="space-y-1">
            {preview.surfaces.map((surface) => (
              <li className="text-sm" key={surface.surfaceId}>
                {surface.kind}: {surface.state}
              </li>
            ))}
          </ul>
        </>
      )}
      {preview.configuration ? (
        <TrashConfigurationImpactList impact={preview.configuration} />
      ) : null}
      {hasActive ? (
        <form.Field name="disposition">
          {(field) => (
            <fieldset className="space-y-2">
              <legend className="font-medium text-sm">
                What happens to active External Surfaces
              </legend>
              <RadioGroup
                disabled={disabled}
                name="surface-disposition"
                onValueChange={(value) =>
                  field.handleChange(value as TrashSurfaceDisposition)
                }
                value={field.state.value}
              >
                <label
                  className="flex items-start gap-2 text-sm"
                  htmlFor="surface-disposition-revoke"
                >
                  <RadioGroupItem
                    id="surface-disposition-revoke"
                    value="revoke"
                  />
                  <span>
                    Revoke (default). Visitor sessions close and the link never
                    works again.
                  </span>
                </label>
                {preview.keepApprovedSurface.available ? (
                  <label
                    className="flex items-start gap-2 text-sm"
                    htmlFor="surface-disposition-keep"
                  >
                    <RadioGroupItem
                      id="surface-disposition-keep"
                      value="keep"
                    />
                    <span>
                      {KEEP_APPROVED_SURFACE_LABEL}. The surface stays frozen on
                      its last approved revision with no live fields, and does
                      not bind again when the record is restored.
                    </span>
                  </label>
                ) : null}
              </RadioGroup>
            </fieldset>
          )}
        </form.Field>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled} size="sm" type="submit">
          {MOVE_TO_TRASH_LABEL}
        </Button>
        <Button
          disabled={disabled}
          onClick={onCancel}
          size="sm"
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
      <p aria-live="polite" className="sr-only">
        {TRASH_LABEL} review for {candidate.label}
      </p>
    </form>
  );
}
