import type { AttentionSignalsAccess } from "@cantiara/api/attention-signals";
import {
  derivePublicRoadmapReviewDue,
  type PublicRoadmapRecordFact,
  type PublicRoadmapReviewAccess,
  publicRoadmapReviewTargetSchema,
  setPublicRoadmapReviewIntervalInputSchema,
} from "@cantiara/api/attention-signals-public-roadmap";

/**
 * Production rule of `public-roadmap-review-due` (spec 71 #476). It reads the
 * public Roadmap facts through a read-only port, writes only the Project's
 * interval and emits through the same registry gate as every producer. It has
 * no way to write an internal status, a public label or a snapshot.
 */

export class PublicRoadmapReviewProjectNotFoundError extends Error {
  readonly code = "PUBLIC_ROADMAP_REVIEW_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "PublicRoadmapReviewProjectNotFoundError";
  }
}

export class PublicRoadmapReviewProjectReadOnlyError extends Error {
  readonly code = "PUBLIC_ROADMAP_REVIEW_PROJECT_READ_ONLY" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is archived and read-only.`);
    this.name = "PublicRoadmapReviewProjectReadOnlyError";
  }
}

export interface PublicRoadmapReviewStore {
  /** `undefined` when the account does not own the Project. */
  get: (
    accountId: string,
    projectId: string,
  ) => Promise<{ days: number | null; readOnly: boolean } | undefined>;
  listConfigured: (
    accountId: string,
  ) => Promise<{ days: number; projectId: string }[]>;
  /** Resolves `false` when the account does not own the Project. */
  set: (
    accountId: string,
    projectId: string,
    days: number | null,
  ) => Promise<boolean>;
}

/** Read-only: the publishing owner's facts. This port has no write member. */
export interface PublicRoadmapFacts {
  read: (
    accountId: string,
    projectId: string,
  ) => Promise<PublicRoadmapRecordFact[]>;
}

export function createPublicRoadmapReview(
  store: PublicRoadmapReviewStore,
  facts: PublicRoadmapFacts,
  attention: AttentionSignalsAccess,
  now: () => Date = () => new Date(),
): PublicRoadmapReviewAccess {
  async function interval(accountId: string, projectId: string) {
    const stored = await store.get(accountId, projectId);
    if (!stored) {
      throw new PublicRoadmapReviewProjectNotFoundError(projectId);
    }
    return stored;
  }

  return {
    async interval(accountId, rawInput) {
      const { projectId } = publicRoadmapReviewTargetSchema.parse(rawInput);
      const stored = await interval(accountId, projectId);
      return { days: stored.days, projectId };
    },

    async refresh(accountId) {
      const configured = await store.listConfigured(accountId);
      const results = await Promise.all(
        configured.map(async ({ days, projectId }) => {
          const due = derivePublicRoadmapReviewDue({
            facts: await facts.read(accountId, projectId),
            intervalDays: days,
            now: now(),
          });
          return await Promise.all(
            due.map((signal) =>
              attention.emit(accountId, {
                eventId: signal.eventId,
                group: { id: signal.recordId, kind: signal.recordKind },
                occurredAt: signal.occurredAt,
                projectId,
                reason: signal.reason,
                signalId: "public-roadmap-review-due",
                targetId: signal.recordId,
              }),
            ),
          );
        }),
      );
      return {
        emitted: results.flat().filter((r) => r.outcome === "created").length,
      };
    },

    async setInterval(accountId, rawInput) {
      const input = setPublicRoadmapReviewIntervalInputSchema.parse(rawInput);
      const stored = await interval(accountId, input.projectId);
      if (stored.readOnly) {
        throw new PublicRoadmapReviewProjectReadOnlyError(input.projectId);
      }
      if (!(await store.set(accountId, input.projectId, input.days))) {
        throw new PublicRoadmapReviewProjectNotFoundError(input.projectId);
      }
      return { days: input.days, projectId: input.projectId };
    },
  };
}
