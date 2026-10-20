import type { DocumentsAccess } from "@cantiara/api/documents";
import type {
  MutationApply,
  MutationCommand,
  MutationPayload,
  MutationReceipt,
} from "@cantiara/api/mutation-and-undo";
import {
  featuresBoundToPrimarySpec,
  type PrimarySpecBinding,
  type SpecChangeReviewSummary,
} from "@cantiara/api/spec-change-review";
import {
  type SpecCandidateLink,
  type SpecCandidateRecordResolution,
  type SpecChangeReviewMark,
  type SpecChangeReviewMarkValue,
  type SpecChangeReviewMutationContracts,
  specCandidateRecordKey,
  specChangeReviewMarkPayloadSchema,
} from "@cantiara/api/spec-change-review-candidates";

import { MutationStaleBaseRevisionError } from "../../mutation-and-undo/server/mutation-contract";
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
  const links = new Map<string, SpecCandidateLink[]>();
  const records = new Map<string, SpecCandidateRecordResolution>();
  const marks = new Map<string, SpecChangeReviewMark>();
  const receipts = new Map<
    string,
    MutationReceipt<SpecChangeReviewMarkValue>
  >();
  let sequence = 0;

  const store: SpecChangeReviewStore = {
    marks: (account, reviewId) =>
      Promise.resolve(
        account === accountId
          ? [...marks.values()].filter((mark) => mark.reviewId === reviewId)
          : [],
      ),
    recordedLinks: (account, review) =>
      Promise.resolve(
        account === accountId ? (links.get(review.documentId) ?? []) : [],
      ),
    resolveRecords: (account, wanted) =>
      Promise.resolve(
        new Map(
          account === accountId
            ? wanted.flatMap((record) => {
                const key = specCandidateRecordKey(record);
                const resolution = records.get(key);
                return resolution ? [[key, resolution] as const] : [];
              })
            : [],
        ),
      ),
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

  const contracts: SpecChangeReviewMutationContracts = {
    mark: (account) => ({
      mutate: async <TPayload extends MutationPayload>(
        command: MutationCommand<TPayload>,
        apply: MutationApply<SpecChangeReviewMarkValue, TPayload>,
      ) => {
        const payload = specChangeReviewMarkPayloadSchema.parse(
          command.payload,
        );
        const review = reviews.find(({ id }) => id === payload.reviewId);
        if (account !== accountId || !review || command.kind !== "human") {
          throw Object.assign(new Error("Target record was not found."), {
            code: "TARGET_NOT_FOUND",
          });
        }
        const replay = receipts.get(command.clientIdempotencyKey);
        if (replay) {
          return replay as MutationReceipt<never>;
        }
        const current = marks.get(command.targetId);
        const currentRevision = current?.revision ?? 0;
        const currentValue = { mark: current ?? null };
        if (command.baseRevision !== currentRevision) {
          throw new MutationStaleBaseRevisionError({
            id: command.targetId,
            revision: currentRevision,
            value: currentValue,
          });
        }
        const committedAt = new Date().toISOString();
        const nextValue = await apply({
          committedAt,
          currentRevision,
          currentValue,
          payload: command.payload,
        });
        if (nextValue.mark) {
          marks.set(command.targetId, nextValue.mark);
        }
        const receipt = {
          actor: command.actor,
          committedAt,
          id: `receipt-${receipts.size + 1}`,
          nextValue,
          origin: {
            clientIdempotencyKey: command.clientIdempotencyKey,
            kind: "human" as const,
          },
          payloadFingerprint: "0".repeat(64),
          previousValue: currentValue,
          revision: currentRevision + 1,
          targetId: command.targetId,
        };
        receipts.set(command.clientIdempotencyKey, receipt);
        return receipt as MutationReceipt<never>;
      },
      replay: (command) =>
        Promise.resolve(
          command.kind === "human"
            ? ((receipts.get(
                command.clientIdempotencyKey,
              ) as MutationReceipt<never>) ?? null)
            : null,
        ),
    }),
  };

  return {
    access: createSpecChangeReview(store, documentAccess),
    /** Records one recorded link from a spec Document to a candidate record. */
    addLink(documentId: string, link: SpecCandidateLink) {
      links.set(documentId, [...(links.get(documentId) ?? []), link]);
    },
    /** Makes a record readable by the account; unregistered records are `No access`. */
    addRecord(
      recordType: string,
      recordId: string,
      resolution: SpecCandidateRecordResolution,
    ) {
      records.set(specCandidateRecordKey({ recordId, recordType }), resolution);
    },
    contracts,
    addDocument(source: MemorySpecDocument) {
      documents.set(source.id, source);
    },
    addWork(work: MemoryFeatureWork) {
      works.push(work);
    },
    reviews,
    works,
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
