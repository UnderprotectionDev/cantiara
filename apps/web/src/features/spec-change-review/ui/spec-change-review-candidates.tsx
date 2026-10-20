// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to one candidate and its note draft.
import {
  SPEC_CANDIDATE_NOTE_MAX_LENGTH,
  SPEC_REVIEW_STATES,
  type SpecChangeReviewCandidate,
  type SpecReviewState,
} from "@cantiara/api/spec-change-review-candidates";
import { Button } from "@cantiara/ui/components/button";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useId, useState } from "react";

export type MarkCandidate = (
  candidate: SpecChangeReviewCandidate,
  state: SpecReviewState,
  note: string | null,
) => void;

function candidateName(candidate: SpecChangeReviewCandidate) {
  const { record } = candidate;
  if (record.broken) {
    return `${record.recordType} unavailable (${record.broken.reason})`;
  }
  return [record.label, record.title].filter(Boolean).join(" ");
}

function candidateScope(candidate: SpecChangeReviewCandidate) {
  if (candidate.documentLevel) {
    return "Document-level candidate";
  }
  if (candidate.changedSection) {
    return `Changed section: ${candidate.changedSection.heading || "Text before the first heading"} (${candidate.changedSection.change})`;
  }
  return `Section ${candidate.identity.sectionId}, not changed in this version pair`;
}

function CandidateRow({
  candidate,
  onMark,
}: {
  candidate: SpecChangeReviewCandidate;
  onMark?: MarkCandidate;
}) {
  const [note, setNote] = useState(candidate.review.note ?? "");
  const noteId = useId();
  const name = candidateName(candidate);
  const saved = candidate.review.state;
  return (
    <li className="space-y-2 rounded-lg border border-border p-4">
      <h5 className="font-medium">{name}</h5>
      <p>{candidateScope(candidate)}</p>
      <p>
        Version {candidate.previousRevision} → Version {candidate.nextRevision}
      </p>
      <p>
        Why:{" "}
        {candidate.reasons
          .map(({ detail, kind }) => (detail ? `${kind} (${detail})` : kind))
          .join(", ")}
      </p>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Review status of {name}</legend>
        {SPEC_REVIEW_STATES.map((state) => (
          <Button
            aria-pressed={saved === state}
            disabled={!onMark}
            key={state}
            onClick={() => onMark?.(candidate, state, note.trim() || null)}
            type="button"
            variant={saved === state ? "default" : "outline"}
          >
            {state}
          </Button>
        ))}
      </fieldset>
      <p>Status: {saved}</p>
      <label htmlFor={noteId}>Note for {name}</label>
      <Textarea
        id={noteId}
        maxLength={SPEC_CANDIDATE_NOTE_MAX_LENGTH}
        onChange={(event) => setNote(event.target.value)}
        value={note}
      />
      <Button
        disabled={!onMark || note.trim() === (candidate.review.note ?? "")}
        onClick={() => onMark?.(candidate, saved, note.trim() || null)}
        type="button"
        variant="outline"
      >
        Save note
      </Button>
    </li>
  );
}

/**
 * Candidates of one exact version pair, derived from recorded links. Each is
 * marked one at a time; there is no bulk control. Marking is review metadata
 * and never changes the candidate record.
 */
export function SpecChangeReviewCandidates({
  candidates,
  onMark,
  status,
}: {
  candidates: SpecChangeReviewCandidate[];
  onMark?: MarkCandidate;
  status?: string;
}) {
  return (
    <section aria-label="Candidates" className="space-y-3">
      <h4 className="font-medium">Candidates</h4>
      <p aria-live="polite" role="status">
        {status ?? ""}
      </p>
      {candidates.length === 0 ? (
        <p>No recorded links point to this Primary spec.</p>
      ) : (
        <ul aria-label="Review candidates" className="space-y-3">
          {candidates.map((candidate) => (
            <CandidateRow
              candidate={candidate}
              // The saved note is part of the key so a refetch resets the draft.
              key={`${candidate.key}|${candidate.review.revision}`}
              onMark={onMark}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
