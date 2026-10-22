// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to one candidate and its note draft.
import type {
  SpecChangeReviewCandidate,
  SpecReviewState,
} from "@cantiara/api/spec-change-review-candidates";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import SpecCandidateReviewForm from "../forms/spec-candidate-review-form";
import {
  type ConfirmFollowUp,
  type PreviewFollowUp,
  SpecFollowUpDialog,
} from "./spec-change-review-follow-up-dialog";

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
  onConfirmFollowUp,
  onMark,
  onPreviewFollowUp,
}: {
  candidate: SpecChangeReviewCandidate;
  onConfirmFollowUp?: ConfirmFollowUp;
  onMark?: MarkCandidate;
  onPreviewFollowUp?: PreviewFollowUp;
}) {
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const name = candidateName(candidate);
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
      <SpecCandidateReviewForm
        candidate={candidate}
        name={name}
        onMark={onMark}
      />
      {candidate.followUp ? (
        <p>
          Follow-up Work:{" "}
          {candidate.followUp.workKey
            ? `${candidate.followUp.workKey} ${candidate.followUp.workTitle ?? ""}`.trim()
            : "no longer available"}
        </p>
      ) : null}
      {candidate.followUp || candidate.record.broken ? null : (
        <Button
          disabled={!(onPreviewFollowUp && onConfirmFollowUp)}
          onClick={() => setFollowUpOpen(true)}
          type="button"
          variant="outline"
        >
          Create Follow-up Work
        </Button>
      )}
      {followUpOpen && onPreviewFollowUp && onConfirmFollowUp ? (
        <SpecFollowUpDialog
          candidate={candidate}
          name={name}
          onClose={() => setFollowUpOpen(false)}
          onConfirm={onConfirmFollowUp}
          onPreview={onPreviewFollowUp}
        />
      ) : null}
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
  onConfirmFollowUp,
  onMark,
  onPreviewFollowUp,
  status,
}: {
  candidates: SpecChangeReviewCandidate[];
  onConfirmFollowUp?: ConfirmFollowUp;
  onMark?: MarkCandidate;
  onPreviewFollowUp?: PreviewFollowUp;
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
              onConfirmFollowUp={onConfirmFollowUp}
              onMark={onMark}
              onPreviewFollowUp={onPreviewFollowUp}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
