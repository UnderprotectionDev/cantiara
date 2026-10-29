// biome-ignore-all lint/suspicious/useAwait: in-memory doubles implement the async ports.

import type {
  ApprovedBuildInPublic,
  BuildInPublicSnapshot,
  BuildInPublicWorkCopy,
} from "@cantiara/api/build-in-public";
import {
  type BuildInPublicFacts,
  type BuildInPublicLatest,
  type BuildInPublicSettingRow,
  type BuildInPublicStore,
  type BuildInPublicWorkFact,
  createBuildInPublic,
} from "../build-in-public";

export const ACCOUNT_ID = "account-1";
export const PROJECT_ID = "project-1";

export function workFact(
  overrides: Partial<BuildInPublicWorkFact> & { id: string },
): BuildInPublicWorkFact {
  return {
    closureResult: null,
    description: null,
    key: overrides.id.toUpperCase(),
    roadmapHorizon: "Now",
    status: "Not Started",
    title: `Internal ${overrides.id}`,
    ...overrides,
  };
}

export function createFixtures(
  input: {
    attachments?: Record<
      string,
      { id: string; name: string; version: number }[]
    >;
    memberships?: { releaseName: string; workId: string }[];
    works?: BuildInPublicWorkFact[];
  } = {},
) {
  const state = {
    attachments: input.attachments ?? {},
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
  const facts: BuildInPublicFacts = {
    attachments: async (_account, workId) => state.attachments[workId] ?? [],
    project: async (accountId, projectId) =>
      accountId === ACCOUNT_ID && projectId === PROJECT_ID
        ? { workspaceId: "workspace-1" }
        : null,
    publishedReleaseMembership: async () => state.memberships,
    roadmapWorks: async () => state.works,
  };

  const settings = new Map<string, BuildInPublicSettingRow>();
  const copies = new Map<string, BuildInPublicWorkCopy>();
  const revisions: BuildInPublicSnapshot[] = [];
  const store: BuildInPublicStore = {
    copies: async () => [...copies.values()],
    latest: async (): Promise<BuildInPublicLatest | null> => {
      const snapshot = revisions.at(-1);
      return snapshot
        ? {
            revision: revisions.length,
            snapshot: structuredClone(snapshot),
            surfaceId: "surface-1",
          }
        : null;
    },
    publish: async ({ projectId, snapshot }) => {
      revisions.push(structuredClone(snapshot));
      const approved: ApprovedBuildInPublic = {
        approvedAt: snapshot.approvedAt,
        projectId,
        revision: revisions.length,
        surfaceId: "surface-1",
      };
      return approved;
    },
    saveCopy: async ({ copy }) => {
      copies.set(copy.workId, copy);
    },
    saveSetting: async ({ projectId, setting }) => {
      settings.set(projectId, structuredClone(setting));
    },
    setting: async (projectId) => settings.get(projectId) ?? null,
  };

  const access = createBuildInPublic({
    facts,
    now: () => new Date("2026-10-29T10:00:00.000Z"),
    store,
  });
  return { access, copies, revisions, settings, state, store };
}
