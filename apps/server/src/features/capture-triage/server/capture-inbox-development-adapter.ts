import type { CaptureInboxTriageAdapter } from "@cantiara/api/capture-triage";

const DEVELOPMENT_PROJECT_NAME = "Development test project";

function developmentTarget(targetId: string) {
  return {
    fields: {},
    id: targetId,
    projectId: null,
    projectName: DEVELOPMENT_PROJECT_NAME,
    recordType: "Work",
    revision: 0,
    title: `Development test target ${targetId}`,
  };
}

/**
 * Work and Document are not available yet. This adapter keeps the Capture Inbox
 * triage seam exercisable in local development and tests without being usable
 * in production.
 */
export function createDevelopmentCaptureInboxTriageAdapter(): CaptureInboxTriageAdapter {
  return {
    attachToExisting: async (input) => ({
      attributedRelationIds: [
        `capture-test-relation:${input.clientIdempotencyKey}`,
      ],
      attributedValueKeys: [`capture-test-value:${input.clientIdempotencyKey}`],
      mergeId: input.mergeId,
    }),
    createRecord: async (input) => ({
      id: `capture-test-record:${input.accountId}:${input.clientIdempotencyKey}`,
      recordType: input.recordType,
    }),
    findRecord: async (_accountId, targetId) => developmentTarget(targetId),
    findSimilar: async (accountId, item) => [
      {
        basis: ["content"],
        id: `capture-test-target:${accountId}:${item.id}`,
        projectId: item.projectId,
        projectName: DEVELOPMENT_PROJECT_NAME,
        recordType: "Work",
        title: `Development test target for ${item.id}`,
      },
    ],
    undoMerge: async () => {
      // The development adapter has no durable target to roll back.
    },
  };
}
