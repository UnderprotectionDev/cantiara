import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import type {
  WorkTemplate,
  WorkTemplatesAccess,
} from "@cantiara/api/work-templates";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const template: WorkTemplate = {
  checklist: [{ id: "check-1", text: "Draft release notes" }],
  createdAt: "2026-09-22T09:00:00.000Z",
  customFieldDefaults: [],
  descriptionSkeleton: "## Outcome",
  id: "template-1",
  name: "Release preparation",
  projectId: "project-1",
  relativeDates: { target: { offsetDays: 10 } },
  revision: 1,
  trashedAt: null,
  type: "Task",
  updatedAt: "2026-09-22T09:00:00.000Z",
};

function createContext(workTemplates: WorkTemplatesAccess): Context {
  return {
    accountAccess: {
      listSessions: async () => [],
      revokeOtherSessions: async () => undefined,
      revokeSession: async () => undefined,
    },
    accountPreferences: {
      get: () => Promise.reject(new Error("Not part of this test.")),
    },
    auth: null,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
    workTemplates,
  };
}

describe("Work Templates RPC", () => {
  test("defines, edits, lists, and trashes Project Work Templates", async () => {
    const access: WorkTemplatesAccess = {
      create: vi.fn().mockResolvedValue(template),
      list: vi.fn().mockResolvedValue([template]),
      trash: vi.fn().mockResolvedValue({
        ...template,
        revision: 3,
        trashedAt: template.updatedAt,
      }),
      update: vi.fn().mockResolvedValue({
        ...template,
        name: "Launch preparation",
        revision: 2,
      }),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });

    await expect(
      client.createWorkTemplate({
        baseRevision: 0,
        checklist: template.checklist,
        clientIdempotencyKey: "create-template-1",
        customFieldDefaults: [],
        descriptionSkeleton: template.descriptionSkeleton,
        name: template.name,
        projectId: template.projectId,
        relativeDates: template.relativeDates,
        type: template.type,
      }),
    ).resolves.toEqual(template);
    await expect(
      client.workTemplates({ projectId: template.projectId }),
    ).resolves.toEqual([template]);
    await expect(
      client.updateWorkTemplate({
        baseRevision: 1,
        checklist: template.checklist,
        clientIdempotencyKey: "update-template-1",
        customFieldDefaults: [],
        descriptionSkeleton: template.descriptionSkeleton,
        name: "Launch preparation",
        relativeDates: template.relativeDates,
        templateId: template.id,
        type: template.type,
      }),
    ).resolves.toMatchObject({ name: "Launch preparation", revision: 2 });
    await expect(
      client.trashWorkTemplate({
        baseRevision: 2,
        clientIdempotencyKey: "trash-template-1",
        templateId: template.id,
      }),
    ).resolves.toMatchObject({ revision: 3, trashedAt: template.updatedAt });

    expect(access.create).toHaveBeenCalledWith("account-1", {
      checklist: template.checklist,
      customFieldDefaults: [],
      descriptionSkeleton: template.descriptionSkeleton,
      name: template.name,
      projectId: template.projectId,
      relativeDates: template.relativeDates,
      type: template.type,
    });
    expect(access.update).toHaveBeenCalledWith(
      "account-1",
      template.id,
      1,
      expect.objectContaining({ name: "Launch preparation" }),
    );
    expect(access.trash).toHaveBeenCalledWith("account-1", template.id, 2);
  });
});
