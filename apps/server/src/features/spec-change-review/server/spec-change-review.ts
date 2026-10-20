import type { DocumentsAccess } from "@cantiara/api/documents";
import {
  diffSpecVersions,
  type SpecChangeReviewAccess,
  type SpecChangeReviewSummary,
  specChangeReviewInputSchema,
  specChangeReviewProjectInputSchema,
} from "@cantiara/api/spec-change-review";
import {
  composeSpecCandidates,
  deriveSpecCandidates,
  type SpecCandidateLink,
  type SpecCandidateRecordResolution,
  type SpecChangeReviewMark,
  specCandidateRecordKey,
} from "@cantiara/api/spec-change-review-candidates";

export class SpecChangeReviewNotFoundError extends Error {
  readonly code = "SPEC_CHANGE_REVIEW_NOT_FOUND" as const;

  constructor(reviewId: string) {
    super(`Spec Change Review ${reviewId} was not found.`);
    this.name = "SpecChangeReviewNotFoundError";
  }
}

export class SpecChangeReviewProjectNotFoundError extends Error {
  readonly code = "SPEC_CHANGE_REVIEW_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "SpecChangeReviewProjectNotFoundError";
  }
}

export class SpecChangeReviewVersionUnavailableError extends Error {
  readonly code = "SPEC_CHANGE_REVIEW_VERSION_UNAVAILABLE" as const;

  constructor(documentId: string, revision: number) {
    super(`Document ${documentId} version ${revision} is unavailable.`);
    this.name = "SpecChangeReviewVersionUnavailableError";
  }
}

/** Port over the persisted version-pair records; both adapters scope by account. */
export interface SpecChangeReviewStore {
  find: (
    accountId: string,
    reviewId: string,
  ) => Promise<SpecChangeReviewSummary | null>;
  /** Newest first; `null` when the Project is not the account's. */
  list: (
    accountId: string,
    projectId: string,
  ) => Promise<SpecChangeReviewSummary[] | null>;
  /** The explicit marks of one review; candidates without a row are `Waiting`. */
  marks: (
    accountId: string,
    reviewId: string,
  ) => Promise<SpecChangeReviewMark[]>;
  /**
   * Every recorded link from the review's spec Document to another record
   * inside the account's Workspace. It reads link tables only; it has no
   * title, text or embedding input.
   */
  recordedLinks: (
    accountId: string,
    review: SpecChangeReviewSummary,
  ) => Promise<SpecCandidateLink[]>;
  /**
   * Resolves candidate records for this account. A record that is missing,
   * another account's or in another Workspace is omitted, never described.
   */
  resolveRecords: (
    accountId: string,
    records: { recordId: string; recordType: string }[],
  ) => Promise<Map<string, SpecCandidateRecordResolution>>;
}

/**
 * Spec Change Review access. The diff always comes from the two exact
 * Document versions of the stored pair, read through Documents.
 */
export function createSpecChangeReview(
  store: SpecChangeReviewStore,
  documents: Pick<DocumentsAccess, "getVersion">,
): SpecChangeReviewAccess {
  return {
    async get(accountId, rawInput) {
      const input = specChangeReviewInputSchema.parse(rawInput);
      const review = await store.find(accountId, input.reviewId);
      if (!review) {
        throw new SpecChangeReviewNotFoundError(input.reviewId);
      }
      const [previous, next] = await Promise.all([
        documents.getVersion(
          accountId,
          review.documentId,
          review.previousRevision,
        ),
        documents.getVersion(accountId, review.documentId, review.nextRevision),
      ]);
      if (!previous) {
        throw new SpecChangeReviewVersionUnavailableError(
          review.documentId,
          review.previousRevision,
        );
      }
      if (!next) {
        throw new SpecChangeReviewVersionUnavailableError(
          review.documentId,
          review.nextRevision,
        );
      }
      const diff = diffSpecVersions(previous, next);
      const drafts = deriveSpecCandidates({
        diff,
        links: await store.recordedLinks(accountId, review),
        next: { body: next.body, revision: next.revision },
        previous: { body: previous.body, revision: previous.revision },
      });
      const [resolutions, marks] = await Promise.all([
        store.resolveRecords(accountId, [
          ...new Map(
            drafts.map(({ identity }) => [
              specCandidateRecordKey(identity),
              {
                recordId: identity.recordId,
                recordType: identity.recordType,
              },
            ]),
          ).values(),
        ]),
        store.marks(accountId, review.id),
      ]);
      return {
        candidates: composeSpecCandidates({
          drafts,
          establishedAt: review.createdAt,
          marks,
          nextRevision: review.nextRevision,
          previousRevision: review.previousRevision,
          resolutions,
        }),
        diff,
        next: {
          revision: next.revision,
          title: next.title,
          type: next.type,
        },
        previous: {
          revision: previous.revision,
          title: previous.title,
          type: previous.type,
        },
        review,
      };
    },
    async list(accountId, rawProjectId) {
      const { projectId } = specChangeReviewProjectInputSchema.parse({
        projectId: rawProjectId,
      });
      const reviews = await store.list(accountId, projectId);
      if (!reviews) {
        throw new SpecChangeReviewProjectNotFoundError(projectId);
      }
      return reviews;
    },
  };
}
