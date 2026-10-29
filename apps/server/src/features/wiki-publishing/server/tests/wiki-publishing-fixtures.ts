// biome-ignore-all lint/suspicious/useAwait: in-memory doubles implement the async ports.

import {
  type CachedSurfaceResponse,
  createExternalSurfaceAccess,
  type ExternalSurfaceResponseCache,
  type ExternalSurfaceStateReader,
} from "@cantiara/api/external-surface-access";
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
import { createWikiPublicRoutes } from "../wiki-publishing-http";

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
    {
      cancelled: boolean;
      documentId: string;
      indexingEnabled: boolean;
      projectId: null;
      snapshots: WikiDocumentSnapshot[];
    }
  >();
  const store: WikiPublishingStore = {
    active: async (_workspaceId, documentId) => {
      const found = [...surfaces.entries()].find(
        ([, surface]) =>
          surface.documentId === documentId && !surface.cancelled,
      );
      const latest = found?.[1].snapshots.at(-1);
      return found && latest
        ? {
            indexingEnabled: found[1].indexingEnabled,
            revision: found[1].snapshots.length,
            slug: latest.slug,
            surfaceId: found[0],
          }
        : null;
    },
    cancel: async (surfaceId) => {
      const surface = surfaces.get(surfaceId);
      if (surface) {
        surface.cancelled = true;
      }
    },
    setIndexing: async (surfaceId, enabled) => {
      const surface = surfaces.get(surfaceId);
      if (surface && !surface.cancelled) {
        surface.indexingEnabled = enabled;
      }
    },
    publish: async (write) => {
      let found = [...surfaces.entries()].find(
        ([, surface]) =>
          surface.documentId === write.documentId && !surface.cancelled,
      );
      if (!found) {
        found = [
          `surface-${surfaces.size + 1}`,
          {
            cancelled: false,
            documentId: write.documentId,
            indexingEnabled: false,
            projectId: null,
            snapshots: [],
          },
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

/** The visitor side over the same in-memory surfaces, behind the shared access module. */
export function createPublicSite(fixtures: ReturnType<typeof createFixtures>) {
  const events: string[] = [];
  const cacheEntries = new Map<string, CachedSurfaceResponse>();
  const reader: ExternalSurfaceStateReader = {
    read: async (surfaceId) => {
      events.push("state");
      const surface = fixtures.surfaces.get(surfaceId);
      return surface
        ? {
            cancelled: surface.cancelled,
            indexingEnabled: surface.indexingEnabled,
            revision: surface.snapshots.length,
          }
        : null;
    },
  };
  const cache: ExternalSurfaceResponseCache = {
    get: async (key) => {
      events.push("cache-get");
      return cacheEntries.get(key) ?? null;
    },
    set: async (key, value) => {
      cacheEntries.set(key, value);
    },
  };
  const objectReads: { attachmentId: string; version: number }[] = [];
  const bytes = new TextEncoder().encode("0123456789");
  const routes = createWikiPublicRoutes({
    access: createExternalSurfaceAccess({ cache, reader }),
    assets: {
      open: async (_surfaceId, file) => {
        objectReads.push(file);
        return { bytes, contentType: "image/png", fileName: "diagram.png" };
      },
    },
    snapshots: {
      latest: async (surfaceId) =>
        fixtures.surfaces.get(surfaceId)?.snapshots.at(-1) ?? null,
    },
  });
  return {
    events,
    get: (path: string, headers: Record<string, string> = {}) =>
      routes.request(path, { headers }),
    objectReads,
    routes,
  };
}
