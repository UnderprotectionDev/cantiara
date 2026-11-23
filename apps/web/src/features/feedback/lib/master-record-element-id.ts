import type { FeedRow } from "@cantiara/api/feedback-feed";

/** DOM id of the master record's own element, shared with the Feedback and Source surfaces. */
export function masterRecordElementId(row: Pick<FeedRow, "id" | "kind">) {
  return `${row.kind === "Feedback" ? "feedback" : "source"}-record-${row.id}`;
}
