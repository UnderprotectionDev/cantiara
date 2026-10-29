// biome-ignore-all lint/suspicious/useAwait: in-memory doubles implement the async ports.

import type {
  PublishedWikiDocument,
  WikiDocumentSnapshot,
} from "@cantiara/api/wiki-publishing";

import {
  createWikiPublishing,
  type WikiPublishingFacts,
  type WikiPublishingStore,
  type WikiSourceDocument,
  type WikiSourceRecord,
} from "../wiki-publishing";

export const ACCOUNT_ID = "account-1";
export const ROOT_ID = "wiki-1";

export const ROOT_BODY = [
  "# Release habits",
  "",
  "See [[record:Decision:decision-1|Ship weekly]] and [[record:Risk:risk-1|Vendor lock-in]].",
  "",
  ':::live-collection{viewId="view-1"}',
  "",
  ':::live-section{documentId="wiki-3" sectionId="intro"}',
].join("\n");

function record(
  overrides: Partial<WikiSourceRecord> & { recordId: string },
): WikiSourceRecord {
  return {
    fields: [{ name: "Title", value: overrides.title ?? "Untitled" }],
    recordType: "Decision",
    title: "Untitled",
    version: null,
    ...overrides,
  };
}

export function createFixtures(input: { rootBody?: string } = {}) {
  const rootBody = input.rootBody ?? ROOT_BODY;
  const root: WikiSourceDocument = {
    ...record({
      fields: [
        { name: "Title", value: "Release habits" },
        { name: "Body", value: rootBody },
      ],
      recordId: ROOT_ID,
      recordType: "Document",
      title: "Release habits",
      version: 4,
    }),
    body: rootBody,
    workspaceId: "workspace-1",
  };
  const child: WikiSourceDocument = {
    ...record({
      fields: [
        { name: "Title", value: "Child notes" },
        { name: "Body", value: "Child body" },
        { classification: "Secret", name: "Recovery code", value: "CODE-123" },
      ],
      recordId: "wiki-2",
      recordType: "Document",
      title: "Child notes",
      version: 2,
    }),
    body: "Child body",
    workspaceId: "workspace-1",
  };
  const state = { child, root };
  const records = new Map<string, WikiSourceRecord>([
    [
      "Decision:decision-1",
      record({
        recordId: "decision-1",
        recordType: "Decision",
        title: "Ship weekly",
      }),
    ],
    [
      "Risk:risk-1",
      record({
        recordId: "risk-1",
        recordType: "Risk",
        title: "Vendor lock-in",
      }),
    ],
  ]);
  const facts: WikiPublishingFacts = {
    attachments: async () => [
      { id: "file-1", name: "diagram.png", version: 3 },
    ],
    backlinks: async () => [
      record({
        recordId: "wiki-9",
        recordType: "Document",
        title: "Private journal",
        version: 7,
      }),
    ],
    childDocuments: async () => [state.child],
    document: async (accountId, id) =>
      accountId === ACCOUNT_ID && id === ROOT_ID ? state.root : null,
    liveSource: async (_accountId, directive) =>
      directive.kind === "Smart Collection"
        ? {
            ...record({
              fields: [{ name: "Title", value: "Open bugs" }],
              recordId: "view-1",
              recordType: "Smart Collection",
              title: "Open bugs",
            }),
            sourceLabel: "Open bugs view",
          }
        : {
            ...record({
              fields: [{ name: "Text", value: "Intro text" }],
              recordId: "wiki-3",
              recordType: "Document section",
              title: "Intro",
            }),
            sourceLabel: "Intro section",
          },
    referenced: async (_accountId, ref) =>
      records.get(`${ref.recordType}:${ref.recordId}`) ?? null,
  };
  const surfaces = new Map<
    string,
    { documentId: string; projectId: null; snapshots: WikiDocumentSnapshot[] }
  >();
  const store: WikiPublishingStore = {
    publish: async (write) => {
      let found = [...surfaces.entries()].find(
        ([, surface]) => surface.documentId === write.documentId,
      );
      if (!found) {
        found = [
          `surface-${surfaces.size + 1}`,
          { documentId: write.documentId, projectId: null, snapshots: [] },
        ];
        surfaces.set(found[0], found[1]);
      }
      found[1].snapshots.push(structuredClone(write.snapshot));
      const published: PublishedWikiDocument = {
        approvedAt: write.snapshot.approvedAt,
        documentId: write.documentId,
        projectId: null,
        revision: found[1].snapshots.length,
        surfaceId: found[0],
      };
      return published;
    },
  };
  const access = createWikiPublishing({
    facts,
    now: () => new Date("2026-10-29T08:00:00.000Z"),
    store,
  });
  return { access, state, store, surfaces };
}
