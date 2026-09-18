import {
  getStarterConfigurationDefinition,
  PROTECTED_WORK_STATUS_OPTIONS,
  STARTER_CONFIGURATION_OPTIONS,
} from "@cantiara/api/project-shell";
import { describe, expect, test } from "vitest";
import {
  createProjectShell,
  type ProjectShellRecord,
  type ProjectShellStore,
  ProjectShortCodeConflictError,
  ProjectShortCodeLockedError,
} from "./project-shell";

function createMemoryStore() {
  const projects = new Map<string, ProjectShellRecord>();
  const reservedCodes = new Map<string, string>();
  let sequence = 0;

  const store: ProjectShellStore = {
    findWorkspaceId: (accountId) =>
      Promise.resolve(
        accountId === "account-1" ? "workspace-1" : "workspace-2",
      ),
    create: (workspaceId, input) => {
      const reservationKey = `${workspaceId}:${input.shortCode}`;
      if (reservedCodes.has(reservationKey)) {
        return Promise.reject(
          new ProjectShortCodeConflictError(input.shortCode),
        );
      }
      sequence += 1;
      const record: ProjectShellRecord = {
        ...input,
        createdAt: "2026-09-17T09:00:00.000Z",
        id: `project-${sequence}`,
        revision: 0,
        updatedAt: "2026-09-17T09:00:00.000Z",
        workCount: 0,
        workspaceId,
      };
      reservedCodes.set(reservationKey, record.id);
      projects.set(record.id, record);
      return Promise.resolve(record);
    },
    find: (workspaceId, projectId) => {
      const record = projects.get(projectId);
      return Promise.resolve(
        record?.workspaceId === workspaceId ? record : null,
      );
    },
    list: (workspaceId) =>
      Promise.resolve(
        [...projects.values()].filter(
          (record) => record.workspaceId === workspaceId,
        ),
      ),
    updateShortCode: (workspaceId, projectId, shortCode) => {
      const record = projects.get(projectId);
      if (!record || record.workspaceId !== workspaceId) {
        return Promise.resolve(null);
      }
      if (record.workCount > 0) {
        return Promise.reject(new ProjectShortCodeLockedError());
      }
      const reservationKey = `${workspaceId}:${shortCode}`;
      const reservationOwner = reservedCodes.get(reservationKey);
      if (
        record.shortCode !== shortCode &&
        reservationOwner &&
        reservationOwner !== projectId
      ) {
        return Promise.reject(new ProjectShortCodeConflictError(shortCode));
      }
      if (record.shortCode !== shortCode) {
        reservedCodes.set(reservationKey, projectId);
      }
      const updated = {
        ...record,
        revision: record.revision + 1,
        shortCode,
      };
      projects.set(projectId, updated);
      return Promise.resolve(updated);
    },
    recordFirstWork: (workspaceId, projectId) => {
      const record = projects.get(projectId);
      if (!record || record.workspaceId !== workspaceId) {
        return Promise.resolve(null);
      }
      const updated = { ...record, workCount: Math.max(1, record.workCount) };
      projects.set(projectId, updated);
      return Promise.resolve(updated);
    },
  };

  return store;
}

describe("Project Shell seam", () => {
  test.each([
    {
      configuration: "Blank Project" as const,
      enabledAreas: ["Work", "Documents"],
      extraPinnedAreas: [],
      preparedStages: [],
      preparedWorkViews: ["Backlog", "Board"],
    },
    {
      configuration: "Solo SaaS" as const,
      enabledAreas: [
        "Work",
        "Documents",
        "Discovery",
        "Decisions",
        "Design",
        "Technical Diagrams",
        "Tests",
        "Releases",
        "Production",
        "GitHub",
      ],
      extraPinnedAreas: [
        "Discovery",
        "Decisions",
        "Design",
        "Tests",
        "Releases",
      ],
      preparedStages: [
        "Discovery",
        "Design",
        "Build",
        "Validate",
        "Release",
        "Operate",
      ],
      preparedWorkViews: ["Backlog", "Board", "Roadmap"],
    },
    {
      configuration: "Open Source Library" as const,
      enabledAreas: [
        "Work",
        "Documents",
        "Decisions",
        "Technical Diagrams",
        "Tests",
        "Releases",
        "GitHub",
      ],
      extraPinnedAreas: ["GitHub", "Tests", "Releases"],
      preparedStages: ["Scope", "Build", "Validate", "Release", "Maintain"],
      preparedWorkViews: ["Backlog", "Board", "Roadmap"],
    },
    {
      configuration: "Mobile Application" as const,
      enabledAreas: [
        "Work",
        "Documents",
        "Discovery",
        "Decisions",
        "Design",
        "Technical Diagrams",
        "Tests",
        "Releases",
        "Production",
        "GitHub",
      ],
      extraPinnedAreas: [
        "Discovery",
        "Design",
        "Tests",
        "Releases",
        "Production",
      ],
      preparedStages: [
        "Discovery",
        "Design",
        "Build",
        "Validate",
        "Release",
        "Operate",
      ],
      preparedWorkViews: ["Backlog", "Board", "Roadmap"],
    },
  ])(
    "applies the $configuration starter structure once without sample content",
    async ({
      configuration,
      enabledAreas,
      extraPinnedAreas,
      preparedStages,
      preparedWorkViews,
    }) => {
      expect(getStarterConfigurationDefinition(configuration)).toEqual({
        enabledAreas,
        extraPinnedAreas,
        preparedStages,
        preparedWorkViews,
      });

      const projectShell = createProjectShell({ store: createMemoryStore() });
      const project = await projectShell.create("account-1", {
        name: `${configuration} Project`,
        starterConfiguration: configuration,
      });

      expect(project.configuration).toEqual({
        enabledAreas,
        extraPinnedAreas,
        preparedStages,
        preparedWorkViews,
        workStatuses: PROTECTED_WORK_STATUS_OPTIONS,
      });
      expect(project).not.toHaveProperty("sampleWork");
      expect(project).not.toHaveProperty("sampleDocuments");
      expect(project).not.toHaveProperty("history");
    },
  );

  test("keeps the closed Starter Configuration catalog and optional profile fields", async () => {
    expect(STARTER_CONFIGURATION_OPTIONS).toEqual([
      "Blank Project",
      "Solo SaaS",
      "Open Source Library",
      "Mobile Application",
    ]);

    const projectShell = createProjectShell({ store: createMemoryStore() });
    const project = await projectShell.create("account-1", {
      logo: "data:image/png;base64,AA==",
      problem: "Payment setup is fragmented.",
      projectName: "Payment App",
      purpose: "Make payment setup clear.",
      scope: "Checkout and billing.",
      starterConfiguration: "Solo SaaS",
      targetDate: "2026-10-01",
    });

    expect(project).toMatchObject({
      logo: "data:image/png;base64,AA==",
      name: "Payment App",
      problem: "Payment setup is fragmented.",
      purpose: "Make payment setup clear.",
      scope: "Checkout and billing.",
      starterConfiguration: "Solo SaaS",
      status: "Active",
      targetDate: "2026-10-01",
    });
    expect(project).not.toHaveProperty("github");
    expect(project).not.toHaveProperty("color");
    expect(project).not.toHaveProperty("css");
    expect(project).not.toHaveProperty("font");
  });

  test("creates an Active Project from the required profile fields", async () => {
    const store: ProjectShellStore = {
      findWorkspaceId: async () => "workspace-1",
      create: async (_workspaceId, input) => ({
        ...input,
        createdAt: "2026-09-17T09:00:00.000Z",
        id: "project-1",
        revision: 0,
        updatedAt: "2026-09-17T09:00:00.000Z",
        workCount: 0,
        workspaceId: "workspace-1",
      }),
      find: async () => null,
      list: async () => [],
      updateShortCode: async () => null,
      recordFirstWork: async () => null,
    };
    const projectShell = createProjectShell({ store });

    await expect(
      projectShell.create("account-1", {
        name: "Payment App",
        starterConfiguration: "Blank Project",
      }),
    ).resolves.toMatchObject({
      name: "Payment App",
      problem: null,
      purpose: null,
      scope: null,
      shortCode: "PAY",
      shortCodeLocked: false,
      starterConfiguration: "Blank Project",
      status: "Active",
      targetDate: null,
    });
  });

  test("keeps the automatic Short code valid for names that start with a number", async () => {
    const projectShell = createProjectShell({ store: createMemoryStore() });

    await expect(
      projectShell.create("account-1", {
        name: "123 Payment App",
        starterConfiguration: "Blank Project",
      }),
    ).resolves.toMatchObject({ shortCode: "PAY" });
  });

  test("suggests an unused code and locks it after the first Work", async () => {
    const projectShell = createProjectShell({ store: createMemoryStore() });

    const first = await projectShell.create("account-1", {
      name: "Payment App",
      starterConfiguration: "Blank Project",
    });
    const edited = await projectShell.updateShortCode(
      "account-1",
      first.id,
      "PAYS",
    );

    expect(edited).toMatchObject({ shortCode: "PAYS", shortCodeLocked: false });

    await expect(
      projectShell.updateShortCode("account-1", first.id, "PAY"),
    ).resolves.toMatchObject({ shortCode: "PAY", shortCodeLocked: false });

    await projectShell.recordFirstWork("account-1", first.id);
    await expect(
      projectShell.updateShortCode("account-1", first.id, "PAYMENTS"),
    ).rejects.toBeInstanceOf(ProjectShortCodeLockedError);

    await expect(
      projectShell.create("account-1", {
        name: "Payment Reports",
        starterConfiguration: "Blank Project",
      }),
    ).resolves.toMatchObject({ shortCode: "PAY-2" });
  });
});
