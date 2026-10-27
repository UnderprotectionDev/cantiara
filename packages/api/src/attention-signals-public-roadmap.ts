import { z } from "zod";

/**
 * `public-roadmap-review-due` (spec 71 #476): the one registry id whose
 * production rule lives with Attention Signals. The Project's optional review
 * interval is the only input the founder gives; the facts about public
 * Roadmap records come from a read-only port and are never written here.
 */

export const PUBLIC_ROADMAP_REVIEW_MIN_DAYS = 7;
export const PUBLIC_ROADMAP_REVIEW_MAX_DAYS = 180;

export const publicRoadmapReviewDaysSchema = z
  .number()
  .int()
  .min(PUBLIC_ROADMAP_REVIEW_MIN_DAYS)
  .max(PUBLIC_ROADMAP_REVIEW_MAX_DAYS);

export const publicRoadmapReviewTargetSchema = z
  .object({ projectId: z.string().trim().min(1).max(200) })
  .strict();
export type PublicRoadmapReviewTarget = z.infer<
  typeof publicRoadmapReviewTargetSchema
>;

/** `days: null` clears the interval: there is no default, so silence returns. */
export const setPublicRoadmapReviewIntervalInputSchema = z
  .object({
    days: publicRoadmapReviewDaysSchema.nullable(),
    projectId: z.string().trim().min(1).max(200),
  })
  .strict();
export type SetPublicRoadmapReviewIntervalInput = z.infer<
  typeof setPublicRoadmapReviewIntervalInputSchema
>;

export const publicRoadmapReviewIntervalSchema = z.object({
  days: publicRoadmapReviewDaysSchema.nullable(),
  projectId: z.string(),
});
export type PublicRoadmapReviewInterval = z.infer<
  typeof publicRoadmapReviewIntervalSchema
>;

export const refreshPublicRoadmapReviewOutputSchema = z.object({
  emitted: z.number().int().min(0),
});

export type PublicRoadmapInternalState = "active" | "closed" | "completed";

/** What the publishing owner knows about one public Roadmap record. */
export interface PublicRoadmapRecordFact {
  /** Time of the latest Onaylı snapshot revizyonu that shows the record. */
  approvedAt: string | null;
  internalState: PublicRoadmapInternalState;
  /** Herkese açık durum etiketi; `null` when the record is not public-labeled. */
  publicLabel: string | null;
  recordId: string;
  recordKind: string;
  snapshotRevision: number | null;
}

export interface PublicRoadmapReviewDue {
  eventId: string;
  occurredAt: string;
  reason: string;
  recordId: string;
  recordKind: string;
  snapshotRevision: number;
}

const DAY_MS = 86_400_000;

/**
 * Pure rule. No interval, no signal. Only an active, public-labeled record
 * whose last Onaylı snapshot revizyonu is at least the interval old is due.
 * The event identity carries the snapshot revision, so the same revision
 * yields one signal however often this runs, and a new revision starts a new
 * interval.
 */
export function derivePublicRoadmapReviewDue(input: {
  facts: readonly PublicRoadmapRecordFact[];
  intervalDays: number | null;
  now: Date;
}): PublicRoadmapReviewDue[] {
  if (input.intervalDays === null) {
    return [];
  }
  const due: PublicRoadmapReviewDue[] = [];
  for (const fact of input.facts) {
    if (
      fact.publicLabel === null ||
      fact.internalState !== "active" ||
      fact.approvedAt === null ||
      fact.snapshotRevision === null
    ) {
      continue;
    }
    const dueAt = new Date(
      new Date(fact.approvedAt).getTime() + input.intervalDays * DAY_MS,
    );
    if (input.now.getTime() < dueAt.getTime()) {
      continue;
    }
    due.push({
      eventId: `public-roadmap-review-due:${fact.recordId}:${fact.snapshotRevision}`,
      occurredAt: dueAt.toISOString(),
      reason: `The public snapshot has not been refreshed for ${input.intervalDays} days.`,
      recordId: fact.recordId,
      recordKind: fact.recordKind,
      snapshotRevision: fact.snapshotRevision,
    });
  }
  return due;
}

export interface PublicRoadmapReviewAccess {
  interval: (
    accountId: string,
    input: PublicRoadmapReviewTarget,
  ) => Promise<PublicRoadmapReviewInterval>;
  /** Emits the due signals of every Project that set an interval. */
  refresh: (accountId: string) => Promise<{ emitted: number }>;
  setInterval: (
    accountId: string,
    input: SetPublicRoadmapReviewIntervalInput,
  ) => Promise<PublicRoadmapReviewInterval>;
}
