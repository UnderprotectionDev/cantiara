// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected review and changed section.
import type {
  SpecChangeReviewDetail,
  SpecChangeReviewSummary,
  SpecDiffLine,
  SpecSectionChange,
} from "@cantiara/api/spec-change-review";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";

import {
  type DiffWalkDirection,
  sectionElementId,
  walkIndex,
  walkStatus,
} from "../lib/diff-walk";
import {
  type MarkCandidate,
  SpecChangeReviewCandidates,
} from "./spec-change-review-candidates";

function sectionHeading(section: SpecSectionChange) {
  if (section.sectionId === null) {
    return "Text before the first heading";
  }
  return section.previousHeading
    ? `${section.previousHeading} → ${section.heading}`
    : section.heading;
}

const LINE_PREFIX: Record<SpecDiffLine["kind"], string> = {
  added: "+ ",
  omitted: "",
  removed: "- ",
  unchanged: "  ",
};

const LINE_LABEL: Record<SpecDiffLine["kind"], string> = {
  added: "Added: ",
  omitted: "",
  removed: "Removed: ",
  unchanged: "",
};

const LINE_CLASS: Record<SpecDiffLine["kind"], string | undefined> = {
  added: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100",
  omitted: "text-muted-foreground",
  removed: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
  unchanged: undefined,
};

function DiffLines({ lines }: { lines: SpecDiffLine[] }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm">
      {lines.map((line, index) => (
        <span
          className={`block ${LINE_CLASS[line.kind] ?? ""}`}
          // biome-ignore lint/suspicious/noArrayIndexKey: Diff lines have no stable identity and are read-only.
          key={index}
        >
          <span className="sr-only">{LINE_LABEL[line.kind]}</span>
          {line.kind === "omitted"
            ? `… ${line.omitted} unchanged lines`
            : `${LINE_PREFIX[line.kind]}${line.text}`}
        </span>
      ))}
    </pre>
  );
}

function ReviewDiff({
  detail,
  markStatus,
  onMark,
}: {
  detail: SpecChangeReviewDetail;
  markStatus?: string;
  onMark?: MarkCandidate;
}) {
  const { diff, review } = detail;
  const [current, setCurrent] = useState<number | null>(null);
  const count = diff.sections.length;
  const currentSection = current === null ? undefined : diff.sections[current];

  function walk(direction: DiffWalkDirection) {
    const index = walkIndex(current, count, direction);
    setCurrent(index);
    if (index !== null) {
      document.getElementById(sectionElementId(review.id, index))?.focus();
    }
  }

  return (
    <div className="space-y-4">
      <p>
        Version {detail.previous.revision} → Version {detail.next.revision}
      </p>
      {diff.titleChange ? (
        <p>
          Title: {diff.titleChange.previous} → {diff.titleChange.next}
        </p>
      ) : null}
      {diff.typeChange ? (
        <p>
          Type: {diff.typeChange.previous} → {diff.typeChange.next}
        </p>
      ) : null}
      {count === 0 ? <p>No section text changed in this version.</p> : null}
      {count > 0 ? (
        <div className="flex gap-2">
          <Button onClick={() => walk("previous")} type="button">
            Previous change
          </Button>
          <Button onClick={() => walk("next")} type="button">
            Next change
          </Button>
        </div>
      ) : null}
      <p aria-live="polite" role="status">
        {walkStatus(
          current,
          count,
          currentSection ? sectionHeading(currentSection) : "",
        )}
      </p>
      <ol aria-label="Changed sections" className="space-y-4">
        {diff.sections.map((section, index) => (
          <li
            className="space-y-2 rounded-lg border border-border p-4"
            key={`${section.sectionId ?? "introduction"}`}
          >
            <h4
              className="font-medium"
              id={sectionElementId(review.id, index)}
              tabIndex={-1}
            >
              {sectionHeading(section)} ({section.change})
            </h4>
            <DiffLines lines={section.lines} />
          </li>
        ))}
      </ol>
      <SpecChangeReviewCandidates
        candidates={detail.candidates}
        onMark={onMark}
        status={markStatus}
      />
    </div>
  );
}

export interface SpecChangeReviewViewProps {
  detail?: SpecChangeReviewDetail;
  markStatus?: string;
  onMark?: MarkCandidate;
  onSelect: (reviewId: string) => void;
  reviews: SpecChangeReviewSummary[];
  selectedId?: string;
}

/** The `Spec Change Review` queue: one row per exact Document version pair. */
export function SpecChangeReviewView({
  detail,
  markStatus,
  onMark,
  onSelect,
  reviews,
  selectedId,
}: SpecChangeReviewViewProps) {
  return (
    <section aria-label="Spec Change Review" className="space-y-4">
      <h3 className="font-semibold">Spec Change Review</h3>
      {reviews.length === 0 ? (
        <p>
          No Spec Change Reviews yet. One opens when a new version of a
          Feature&apos;s Primary spec is saved.
        </p>
      ) : (
        <ul aria-label="Spec Change Review queue" className="space-y-2">
          {reviews.map((review) => (
            <li key={review.id}>
              <Button
                aria-current={review.id === selectedId ? "true" : undefined}
                onClick={() => onSelect(review.id)}
                type="button"
                variant={review.id === selectedId ? "default" : "outline"}
              >
                {review.featureKey} {review.featureTitle} · Primary spec{" "}
                {review.documentTitle} · Version {review.previousRevision} →
                Version {review.nextRevision}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {detail ? (
        <ReviewDiff
          detail={detail}
          key={detail.review.id}
          markStatus={markStatus}
          onMark={onMark}
        />
      ) : null}
    </section>
  );
}
