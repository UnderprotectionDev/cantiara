import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { TestReviewSession } from "@cantiara/api/test-review";
import {
  resultLabel,
  type TestReviewResultEnd,
} from "@cantiara/api/test-review-signals";
import { accountDateFormatter } from "@/features/account-preferences/lib/account-preferences-format";

export function endLine(end: TestReviewResultEnd) {
  const reported = end.normalizedResult
    ? resultLabel(end.normalizedResult)
    : "Not reported";
  const raw = end.rawResult ? ` (${end.rawResult})` : "";
  const current =
    end.currentResult && end.currentResult !== end.normalizedResult
      ? `, current ${resultLabel(end.currentResult)}`
      : "";
  return `${end.title} by ${end.executorName}: ${reported}${raw}${current}`;
}

export function allItems(
  sessions: TestReviewSession[],
  preferences?: AccountPreferences,
) {
  const formatDate = accountDateFormatter(preferences);
  return sessions.flatMap((session) =>
    session.items.map((item) => ({
      id: item.id,
      label: `${item.title} (${session.executorName}, ${formatDate(session.reportedAt)})`,
    })),
  );
}
