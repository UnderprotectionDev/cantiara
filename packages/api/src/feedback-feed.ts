import { z } from "zod";

import { feedbackAttachmentSchema, feedbackStatusSchema } from "./feedback";

const identifierSchema = z.string().trim().min(1).max(255);
const timestampSchema = z.string().datetime({ offset: true });

/** The two master record kinds the Feed reads; a row is never a third kind. */
export const FEED_ROW_KINDS = ["Feedback", "Source"] as const;
export const feedRowKindSchema = z.enum(FEED_ROW_KINDS);
export type FeedRowKind = z.infer<typeof feedRowKindSchema>;

/**
 * Smart Collection vocabulary, not a second query language: `sourceType` and
 * `conditions.status` keep their Smart Collection names. A Source has no
 * lifecycle status, so a status condition keeps Feedback rows only.
 */
export const feedConditionsSchema = z
  .object({ status: feedbackStatusSchema.optional() })
  .strict();

export const FEED_SORT_OPTIONS = ["Newest first", "Oldest first"] as const;
export const feedSortSchema = z.enum(FEED_SORT_OPTIONS);
export type FeedSort = z.infer<typeof feedSortSchema>;

/** Filter and sort are read-only view parameters; no field can carry a status or priority. */
export const feedInputSchema = z
  .object({
    conditions: feedConditionsSchema.default({}),
    projectId: identifierSchema,
    sort: feedSortSchema.default("Newest first"),
    sourceType: feedRowKindSchema.optional(),
  })
  .strict();

export type FeedInput = z.input<typeof feedInputSchema>;
export type ParsedFeedInput = z.output<typeof feedInputSchema>;

export const feedRelatedRecordSchema = z
  .object({
    id: identifierSchema,
    projectId: identifierSchema,
    title: z.string().min(1),
    type: z.enum(["Work", "Decision"]),
  })
  .strict();

export type FeedRelatedRecord = z.infer<typeof feedRelatedRecordSchema>;

/**
 * One Feed row is a projection of a master record: `id` and `projectId` are
 * the master record's own, so `Open Source Record` opens that same record. The
 * schema is strict: there is no like, comment, vote, read or notification field.
 */
export const feedRowSchema = z
  .object({
    attachments: z.array(feedbackAttachmentSchema),
    body: z.string(),
    id: identifierSchema,
    identity: z.string().min(1).nullable(),
    kind: feedRowKindSchema,
    occurredAt: timestampSchema,
    projectId: identifierSchema,
    related: z.array(feedRelatedRecordSchema),
    status: feedbackStatusSchema.nullable(),
    title: z.string().min(1),
  })
  .strict();

export type FeedRow = z.infer<typeof feedRowSchema>;

export const feedSchema = z
  .object({ readOnly: z.boolean(), rows: z.array(feedRowSchema) })
  .strict();

export type Feed = z.infer<typeof feedSchema>;

/** Read-only persistence port: it has no write method, so the Feed cannot write status. */
export interface FeedbackFeedStore {
  /** `null` means the Project is not owned or does not exist. */
  read: (accountId: string, projectId: string) => Promise<Feed | null>;
}

export interface FeedbackFeedAccess {
  feed: (accountId: string, input: FeedInput) => Promise<Feed>;
}

/** Applies Smart Collection style filter and sort to rows without changing them. */
export function selectFeedRows(
  rows: readonly FeedRow[],
  query: Pick<ParsedFeedInput, "conditions" | "sort" | "sourceType">,
): FeedRow[] {
  const direction = query.sort === "Oldest first" ? 1 : -1;
  return rows
    .filter(
      (row) =>
        (query.sourceType === undefined || row.kind === query.sourceType) &&
        (query.conditions.status === undefined ||
          row.status === query.conditions.status),
    )
    .sort(
      (left, right) =>
        direction *
          (Date.parse(left.occurredAt) - Date.parse(right.occurredAt)) ||
        left.id.localeCompare(right.id),
    );
}
