import {
  type FeedbackFeedAccess,
  type FeedbackFeedStore,
  feedInputSchema,
  selectFeedRows,
} from "@cantiara/api/feedback-feed";
import { FeedbackProjectNotFoundError } from "./feedback";

/**
 * Feed seam over the same Feedback and long-body Source master records. The
 * store port is read-only, so ordering or filtering cannot write a status or
 * priority, and nothing here emits a notification signal or rechecks a Source.
 */
export function createFeedbackFeed(
  store: FeedbackFeedStore,
): FeedbackFeedAccess {
  return {
    async feed(accountId, input) {
      const query = feedInputSchema.parse(input);
      const feed = await store.read(accountId, query.projectId);
      if (!feed) {
        throw new FeedbackProjectNotFoundError(query.projectId);
      }
      return {
        readOnly: feed.readOnly,
        rows: selectFeedRows(feed.rows, query),
      };
    },
  };
}
