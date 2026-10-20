import type { DocumentsAccess } from "@cantiara/api/documents";
import {
  featuresBoundToPrimarySpec,
  type PrimarySpecBinding,
  type SpecChangeReviewSummary,
} from "@cantiara/api/spec-change-review";

import {
  createSpecChangeReview,
  type SpecChangeReviewStore,
} from "./spec-change-review";

export interface MemoryFeatureWork extends PrimarySpecBinding {
  key: string;
  title: string;
}

export interface MemorySpecDocument {
  id: string;
  projectId: string;
  /** Exact bodies by revision, oldest first (revision = index + 1). */
  versions: { body: string; title: string; type: string }[];
}

/**
 * In-memory Spec Change Review seam for tests. `saveVersion` is the test
 * double of a Document version save; it applies the same opening rule as the
 * PostgreSQL adapter (`featuresBoundToPrimarySpec`).
 */
export function createMemorySpecChangeReview(accountId = "account-1") {
  const works: MemoryFeatureWork[] = [];
  const documents = new Map<string, MemorySpecDocument>();
  const reviews: SpecChangeReviewSummary[] = [];
  let sequence = 0;

  const store: SpecChangeReviewStore = {
    find: (account, reviewId) =>
      Promise.resolve(
        account === accountId
          ? (reviews.find(({ id }) => id === reviewId) ?? null)
          : null,
      ),
    list: (account, projectId) =>
      Promise.resolve(
        account === accountId
          ? reviews.filter((review) => review.projectId === projectId).reverse()
          : null,
      ),
  };

  const documentAccess: Pick<DocumentsAccess, "getVersion"> = {
    getVersion(account, documentId, revision) {
      const source = documents.get(documentId);
      const version = source?.versions[revision - 1];
      if (account !== accountId || !(source && version)) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        archivedAt: null,
        body: version.body,
        createdAt: "2026-10-01T09:00:00.000Z",
        id: source.id,
        inlineTags: [],
        projectId: source.projectId,
        revision,
        title: version.title,
        type: version.type,
        updatedAt: "2026-10-01T09:00:00.000Z",
        workspaceId: null,
      } as unknown as NonNullable<
        Awaited<ReturnType<DocumentsAccess["getVersion"]>>
      >);
    },
  };

  return {
    access: createSpecChangeReview(store, documentAccess),
    addDocument(source: MemorySpecDocument) {
      documents.set(source.id, source);
    },
    addWork(work: MemoryFeatureWork) {
      works.push(work);
    },
    reviews,
    /** Saves a new version of a Document and opens the queue when it applies. */
    saveVersion(
      documentId: string,
      version: { body: string; title?: string; type?: string },
    ) {
      const source = documents.get(documentId);
      const previous = source?.versions.at(-1);
      if (!(source && previous)) {
        throw new Error(`Unknown Document ${documentId}`);
      }
      source.versions.push({
        body: version.body,
        title: version.title ?? previous.title,
        type: version.type ?? previous.type,
      });
      const nextRevision = source.versions.length;
      for (const feature of featuresBoundToPrimarySpec(
        works.filter(({ projectId }) => projectId === source.projectId),
        documentId,
      )) {
        sequence += 1;
        reviews.push({
          createdAt: "2026-10-01T09:00:00.000Z",
          documentId,
          documentTitle: version.title ?? previous.title,
          featureId: feature.id,
          featureKey: feature.key,
          featureTitle: feature.title,
          id: `review-${sequence}`,
          nextRevision,
          previousRevision: nextRevision - 1,
          projectId: source.projectId,
        });
      }
    },
  };
}
