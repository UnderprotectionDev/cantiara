import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import type { WorkDraft, WorkDraftsAccess } from "@cantiara/api/work-drafts";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const draft: WorkDraft = {
  checklist: [],
  customFieldValues: [],
  createdAt: "2026-09-19T09:00:00.000Z",
  description: null,
  id: "draft-1",
  projectId: "project-1",
  revision: 1,
  title: "Investigate payment failures",
  type: "Research",
  updatedAt: "2026-09-19T09:00:00.000Z",
};

const work: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-19T09:01:00.000Z",
  description: null,
  featureHealthHistory: [],
  id: "work-1",
  key: "PAY-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  recreatedFrom: null,
  revision: 1,
  status: "Not Started",
  title: draft.title,
  type: draft.type,
  updatedAt: "2026-09-19T09:01:00.000Z",
};

function createContext(workDrafts: WorkDraftsAccess): Context {
  return {
    accountAccess: {
      listSessions: async () => [],
      revokeOtherSessions: async () => undefined,
      revokeSession: async () => undefined,
    },
    accountPreferences: {
      get: async () => ({
        appearance: "Dark",
        dateFormat: "locale",
        firstDayOfWeek: "Monday",
        isSaved: false,
        locale: "en-GB",
        revision: 0,
        savedAt: null,
        timeZone: "Europe/Istanbul",
      }),
    },
    auth: null,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
    workDrafts,
  };
}

describe("Work Drafts RPC", () => {
  test("keeps Drafts behind the authenticated Work Drafts interface", async () => {
    const list = vi.fn().mockResolvedValue([draft]);
    const save = vi.fn().mockResolvedValue(draft);
    const finalize = vi.fn().mockResolvedValue(work);
    const workDrafts: WorkDraftsAccess = {
      delete: vi.fn(),
      finalize,
      find: vi.fn().mockResolvedValue(draft),
      list,
      save,
    };
    const client = createRouterClient(appRouter, {
      context: createContext(workDrafts),
    });

    await expect(
      client.workDrafts({ projectId: "project-1" }),
    ).resolves.toEqual([draft]);
    await expect(
      client.saveWorkDraft({
        baseRevision: 1,
        checklist: [],
        clientIdempotencyKey: "draft-save-1",
        description: null,
        draftId: draft.id,
        projectId: draft.projectId,
        title: draft.title,
        type: draft.type,
      }),
    ).resolves.toEqual(draft);
    await expect(
      client.finalizeWorkDraft({
        baseRevision: draft.revision,
        clientIdempotencyKey: "draft-finalize-1",
        draftId: draft.id,
      }),
    ).resolves.toEqual(work);

    expect(list).toHaveBeenCalledWith("account-1", "project-1");
    expect(save).toHaveBeenCalledWith("account-1", {
      baseRevision: 1,
      checklist: [],
      clientIdempotencyKey: "draft-save-1",
      customFieldValues: [],
      description: null,
      draftId: draft.id,
      projectId: draft.projectId,
      title: draft.title,
      type: draft.type,
    });
    expect(finalize).toHaveBeenCalledWith("account-1", {
      baseRevision: draft.revision,
      clientIdempotencyKey: "draft-finalize-1",
      draftId: draft.id,
    });
  });
});
