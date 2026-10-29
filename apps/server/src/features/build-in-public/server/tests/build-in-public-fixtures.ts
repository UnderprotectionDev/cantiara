// biome-ignore-all lint/suspicious/useAwait: in-memory doubles implement the async ports.

import type {
  ApprovedBuildInPublic,
  BuildInPublicSnapshot,
  BuildInPublicWorkCopy,
} from "@cantiara/api/build-in-public";
import {
  createExternalSurfaceAccess,
  type ExternalSurfaceResponseCache,
  type ExternalSurfaceState,
} from "@cantiara/api/external-surface-access";
import {
  type BuildInPublicFacts,
  type BuildInPublicLatest,
  type BuildInPublicSettingRow,
  type BuildInPublicStore,
  type BuildInPublicWorkFact,
  createBuildInPublic,
} from "../build-in-public";
import { createBuildInPublicRoutes } from "../build-in-public-http";
import type { BuildInPublicSourceMember } from "../build-in-public-project-view";
import type { BuildInPublicPublicationStore } from "../build-in-public-publication";

export const ACCOUNT_ID = "account-1";
export const OTHER_ACCOUNT_ID = "account-2";
export const PROJECT_ID = "project-1";
export const WORKSPACE_ID = "workspace-1";
export const NOW = new Date("2026-10-29T10:00:00.000Z");

export function workFact(
  overrides: Partial<BuildInPublicWorkFact> & { id: string },
): BuildInPublicWorkFact {
  return {
    closureResult: null,
    description: null,
    key: overrides.id.toUpperCase(),
    roadmapHorizon: "Now",
    status: "Not Started",
    targetDate: null,
    title: `Internal ${overrides.id}`,
    ...overrides,
  };
}

export function memberFact(
  overrides: Partial<BuildInPublicSourceMember> & { recordId: string },
): BuildInPublicSourceMember {
  return {
    date: null,
    fields: [],
    kind: "Document",
    title: `Record ${overrides.recordId}`,
    wall: null,
    ...overrides,
  };
}

interface FakeSurface {
  cancelled: boolean;
  id: string;
  indexingEnabled: boolean;
  revisions: BuildInPublicSnapshot[];
  slugs: { aliases: string[]; canonical: string | null };
}

export function createFixtures(
  input: {
    attachments?: Record<
      string,
      { id: string; name: string; version: number }[]
    >;
    members?: BuildInPublicSourceMember[];
    memberships?: { releaseName: string; workId: string }[];
    works?: BuildInPublicWorkFact[];
  } = {},
) {
  const state = {
    attachments: input.attachments ?? {},
    members: input.members ?? [],
    memberships: input.memberships ?? [],
    works: input.works ?? [
      workFact({ id: "work-a" }),
      workFact({ id: "work-b", status: "In Progress" }),
      workFact({
        closureResult: "Completed",
        id: "work-c",
        status: "Closed",
      }),
    ],
  };
  /** Every read of the live Workspace; a visitor request must never add to it. */
  const workspaceReads = { count: 0 };
  const read = <T>(value: T) => {
    workspaceReads.count += 1;
    return value;
  };
  const facts: BuildInPublicFacts = {
    attachments: async (_account, workId) =>
      read(state.attachments[workId] ?? []),
    members: async () => read(state.members),
    project: async (accountId, projectId) =>
      accountId === ACCOUNT_ID && projectId === PROJECT_ID
        ? read({ workspaceId: WORKSPACE_ID })
        : null,
    publishedReleaseMembership: async () => read(state.memberships),
    roadmapWorks: async () => read(state.works),
  };

  const settings = new Map<string, BuildInPublicSettingRow>();
  const copies = new Map<string, BuildInPublicWorkCopy>();
  const surfaces: FakeSurface[] = [];
  /** Every write the seam makes, so a test can show what an action did not do. */
  const writes: string[] = [];
  const active = () => surfaces.find((surface) => !surface.cancelled);
  const store: BuildInPublicStore & BuildInPublicPublicationStore = {
    cancel: async (surfaceId) => {
      const surface = surfaces.find((entry) => entry.id === surfaceId);
      if (!surface || surface.cancelled) {
        return false;
      }
      surface.cancelled = true;
      surface.slugs = { aliases: [], canonical: null };
      writes.push("cancel");
      return true;
    },
    changeSlug: async ({ slug, surfaceId }) => {
      const taken = surfaces.some(
        (other) =>
          other.id !== surfaceId &&
          (other.slugs.canonical === slug ||
            other.slugs.aliases.includes(slug)),
      );
      const surface = surfaces.find((entry) => entry.id === surfaceId);
      if (taken || !surface) {
        return false;
      }
      if (surface.slugs.canonical && surface.slugs.canonical !== slug) {
        surface.slugs.aliases.push(surface.slugs.canonical);
      }
      surface.slugs.aliases = surface.slugs.aliases.filter((s) => s !== slug);
      surface.slugs.canonical = slug;
      return true;
    },
    copies: async () => [...copies.values()],
    latest: async (): Promise<BuildInPublicLatest | null> => {
      const surface = active();
      const snapshot = surface?.revisions.at(-1);
      return surface && snapshot
        ? {
            indexingEnabled: surface.indexingEnabled,
            revision: surface.revisions.length,
            snapshot: structuredClone(snapshot),
            surfaceId: surface.id,
          }
        : null;
    },
    publish: async ({ projectId, slug, snapshot }) => {
      let surface = active();
      if (!surface) {
        surface = {
          cancelled: false,
          id: `surface-${surfaces.length + 1}`,
          indexingEnabled: false,
          revisions: [],
          slugs: { aliases: [], canonical: slug },
        };
        surfaces.push(surface);
      }
      surface.slugs.canonical ??= slug;
      surface.revisions.push(structuredClone(snapshot));
      writes.push("publish");
      const approved: ApprovedBuildInPublic = {
        approvedAt: snapshot.approvedAt,
        projectId,
        revision: surface.revisions.length,
        surfaceId: surface.id,
      };
      return approved;
    },
    saveCopy: async ({ copy }) => {
      copies.set(copy.workId, copy);
    },
    saveSetting: async ({ projectId, setting }) => {
      settings.set(projectId, structuredClone(setting));
    },
    setIndexing: async (surfaceId, enabled) => {
      const surface = surfaces.find((entry) => entry.id === surfaceId);
      if (!surface || surface.cancelled) {
        return false;
      }
      surface.indexingEnabled = enabled;
      return true;
    },
    setting: async (projectId) => settings.get(projectId) ?? null,
    slugOwner: async (_workspaceId, slug) =>
      surfaces.find(
        (surface) =>
          surface.slugs.canonical === slug ||
          surface.slugs.aliases.includes(slug),
      )?.id ?? null,
    slugs: async (surfaceId) =>
      structuredClone(
        surfaces.find((surface) => surface.id === surfaceId)?.slugs ?? {
          aliases: [],
          canonical: null,
        },
      ),
  };

  const access = createBuildInPublic({ facts, now: () => NOW, store });
  return {
    access,
    copies,
    /** Every approved revision across surfaces, oldest first. */
    get revisions() {
      return surfaces.flatMap((surface) => surface.revisions);
    },
    settings,
    state,
    store,
    surfaces,
    workspaceReads,
    writes,
  };
}

export type Fixtures = ReturnType<typeof createFixtures>;

/** The visitor site over the same surfaces, with no access to `facts`. */
export function createPublicSite(
  fixtures: Fixtures,
  options: {
    cache?: ExternalSurfaceResponseCache;
    ownerSession?: { current: string | null };
    now?: () => Date;
  } = {},
) {
  const reader = {
    read: async (surfaceId: string): Promise<ExternalSurfaceState | null> => {
      const surface = fixtures.surfaces.find((entry) => entry.id === surfaceId);
      return surface
        ? {
            cancelled: surface.cancelled,
            indexingEnabled: surface.indexingEnabled,
            revision: surface.revisions.length,
          }
        : null;
    },
  };
  const surfaceOf = (surfaceId: string) =>
    fixtures.surfaces.find((entry) => entry.id === surfaceId);
  const routes = createBuildInPublicRoutes({
    access: createExternalSurfaceAccess({ cache: options.cache, reader }),
    assets: {
      open: async (_surfaceId, file) => ({
        bytes: new TextEncoder().encode(
          `file-${file.attachmentId}-${file.version}`,
        ),
        contentType: "text/plain",
        fileName: `${file.attachmentId}.txt`,
      }),
    },
    now: options.now ?? (() => NOW),
    reader,
    slugs: {
      read: async (surfaceId) =>
        structuredClone(
          surfaceOf(surfaceId)?.slugs ?? { aliases: [], canonical: null },
        ),
    },
    snapshots: {
      latest: async (surfaceId) =>
        structuredClone(surfaceOf(surfaceId)?.revisions.at(-1) ?? null),
    },
    viewer: {
      controls: async (_request, surfaceId) =>
        options.ownerSession?.current === ACCOUNT_ID && surfaceOf(surfaceId)
          ? {
              diffHref:
                "https://app.example/projects/project-1#build-in-public-publish-diff",
              sourceHref: "https://app.example/projects/project-1",
            }
          : null,
    },
  });
  return {
    get: async (path: string, init?: RequestInit) =>
      await routes.request(path, init),
    routes,
  };
}

export async function enable(fixtures: Fixtures) {
  await fixtures.access.setEnabled(ACCOUNT_ID, {
    enabled: true,
    projectId: PROJECT_ID,
  });
}

export async function previewOf(
  fixtures: Fixtures,
  metadata?: Parameters<Fixtures["access"]["preview"]>[1]["metadata"],
) {
  const preview = await fixtures.access.preview(ACCOUNT_ID, {
    metadata,
    projectId: PROJECT_ID,
  });
  if (!preview) {
    throw new Error("no preview");
  }
  return preview;
}

/** Approve every previewed item the filter keeps; one call is one new revision. */
export async function approveItems(
  fixtures: Fixtures,
  options: {
    explanation?: string | null;
    featured?: { endsAt: string; recordId: string } | null;
    keep?: (item: { id: string; kind: string }) => boolean;
    metadata?: Parameters<Fixtures["access"]["preview"]>[1]["metadata"];
    publishAnyway?: boolean;
  } = {},
) {
  await enable(fixtures);
  const preview = await previewOf(fixtures, options.metadata);
  const keep = options.keep ?? (() => true);
  const approved = await fixtures.access.approve(ACCOUNT_ID, {
    approval: {
      approvedItemIds: preview.items.filter(keep).map((item) => item.id),
      explanation: options.explanation,
      featured: options.featured,
      fingerprint: preview.fingerprint,
      ...(options.metadata ? { metadata: options.metadata } : {}),
      publishAnyway: options.publishAnyway ?? true,
    },
    projectId: PROJECT_ID,
  });
  if (!approved) {
    throw new Error("approval expected");
  }
  return { approved, preview };
}
