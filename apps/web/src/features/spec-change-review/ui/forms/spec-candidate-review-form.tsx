// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to one candidate and its note draft.
import {
  markSpecChangeReviewCandidateInputSchema,
  SPEC_CANDIDATE_NOTE_MAX_LENGTH,
  SPEC_REVIEW_STATES,
  type SpecChangeReviewCandidate,
} from "@cantiara/api/spec-change-review-candidates";
import { Button } from "@cantiara/ui/components/button";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useId } from "react";
import type { MarkCandidate } from "../components/spec-change-review-candidates";

const noteSchema = markSpecChangeReviewCandidateInputSchema.shape.note;

/** Review status buttons and the note of one candidate; the note saves on submit. */
export default function SpecCandidateReviewForm({
  candidate,
  name,
  onMark,
}: {
  candidate: SpecChangeReviewCandidate;
  name: string;
  onMark?: MarkCandidate;
}) {
  const noteId = useId();
  const saved = candidate.review.state;
  const savedNote = candidate.review.note ?? "";
  const form = useForm({
    defaultValues: { note: savedNote },
    onSubmit: ({ value }) => {
      const parsed = noteSchema.safeParse(value.note.trim() || null);
      if (!parsed.success) {
        return;
      }
      onMark?.(candidate, saved, parsed.data);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Review status of {name}</legend>
        {SPEC_REVIEW_STATES.map((state) => (
          <Button
            aria-pressed={saved === state}
            disabled={!onMark}
            key={state}
            onClick={() =>
              onMark?.(candidate, state, form.state.values.note.trim() || null)
            }
            type="button"
            variant={saved === state ? "default" : "outline"}
          >
            {state}
          </Button>
        ))}
      </fieldset>
      <p>Status: {saved}</p>
      <form.Field name="note">
        {(field) => (
          <>
            <label htmlFor={noteId}>Note for {name}</label>
            <Textarea
              id={noteId}
              maxLength={SPEC_CANDIDATE_NOTE_MAX_LENGTH}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.note}>
        {(note) => (
          <Button
            disabled={!onMark || note.trim() === savedNote}
            type="submit"
            variant="outline"
          >
            Save note
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
