import type { Context } from "@cantiara/api/context";
import type {
  MutationApply,
  MutationCommand,
  MutationContract,
  MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import type {
  ProjectProfile,
  ProjectShellAccess,
  ProjectShellMutationContracts,
  ProjectShellMutationValue,
} from "@cantiara/api/project-shell";
import { getProjectShellConfiguration } from "@cantiara/api/project-shell";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";
import {
  ProjectShortCodeConflictError,
  ProjectShortCodeLockedError,
} from "./project-shell";

const project: ProjectProfile = {
  configuration: getProjectShellConfiguration("Blank Project"),
  createdAt: "2026-09-17T09:00:00.000Z",
  id: "project-1",
  logo: null,
  name: "Payment App",
  problem: null,
  purpose: null,
  revision: 1,
  scope: null,
  shortCode: "PAY",
  shortCodeLocked: false,
  starterConfiguration: "Blank Project",
  status: "Active",
  targetDate: null,
  updatedAt: "2026-09-17T09:00:00.000Z",
};

function createContext(
  projectShell: ProjectShellAccess,
  projectShellMutationContracts: ProjectShellMutationContracts,
  githubStatus: "available" | "waiting" = "available",
): Context {
  return {
    accountAccess: {
      listSessions: async () => [],
      revokeOtherSessions: async () => undefined,
      revokeSession: async () => undefined,
    },
    accountPreferences: {
      get: () =>
        Promise.reject(
          new Error("Account Preferences are not part of this test."),
        ),
    },
    auth: null,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => githubStatus },
    projectShell,
    projectShellMutationContracts,
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
  };
}

function createProjectUpdateMutation(
  getCurrentProject: () => ProjectProfile,
  setCurrentProject: (project: ProjectProfile) => void,
): MutationContract<ProjectShellMutationValue> {
  return {
    mutate: async <TPayload extends MutationPayload>(
      command: MutationCommand<TPayload>,
      apply: MutationApply<ProjectShellMutationValue, TPayload>,
    ) => {
      if (command.kind !== "human") {
        throw new Error("Expected a human Project command.");
      }
      const previousProject = getCurrentProject();
      const nextValue = await apply({
        currentRevision: previousProject.revision,
        currentValue: { project: previousProject },
        payload: command.payload,
      });
      const nextProject = nextValue.project ?? previousProject;
      setCurrentProject(nextProject);
      return {
        actor: command.actor,
        committedAt: "2026-09-17T09:00:00.000Z",
        id: `receipt-${nextProject.revision}`,
        nextValue,
        origin: {
          clientIdempotencyKey: command.clientIdempotencyKey,
          kind: "human" as const,
        },
        payloadFingerprint: "0".repeat(64),
        previousValue: { project: previousProject },
        revision: nextProject.revision,
        targetId: command.targetId,
      };
    },
  };
}

describe("Project Shell RPC", () => {
  test("creates and reads a Project through the authenticated interface", async () => {
    const calls: string[] = [];
    const projectShell: ProjectShellAccess = {
      create: async () => project,
      find: async () => project,
      list: async () => [project],
      recordFirstWork: async () => project,
      updateShortCode: async () => project,
    };
    const projectShellMutationContracts: ProjectShellMutationContracts = {
      create: () =>
        ({
          mutate: (command: MutationCommand) => {
            if (command.kind !== "human") {
              return Promise.reject(
                new Error("Expected a human Project command."),
              );
            }
            calls.push(
              `${command.actor.actorId}:${(command.payload as { name: string }).name}`,
            );
            return Promise.resolve({
              actor: command.actor,
              committedAt: "2026-09-17T09:00:00.000Z",
              id: "receipt-1",
              nextValue: { project },
              origin: {
                clientIdempotencyKey: command.clientIdempotencyKey,
                kind: "human" as const,
              },
              payloadFingerprint: "0".repeat(64),
              previousValue: { project: null },
              revision: 1,
              targetId: command.targetId,
            });
          },
        }) as MutationContract<ProjectShellMutationValue>,
      update: () =>
        ({
          mutate: () =>
            Promise.reject(
              new Error("Project update is not part of this test."),
            ),
        }) as MutationContract<ProjectShellMutationValue>,
    };
    const client = createRouterClient(appRouter, {
      context: createContext(
        projectShell,
        projectShellMutationContracts,
        "waiting",
      ),
    });

    await expect(
      client.createProject({
        baseRevision: 0,
        clientIdempotencyKey: "create-project-1",
        name: "Payment App",
        starterConfiguration: "Blank Project",
      }),
    ).resolves.toEqual(project);
    await expect(client.projects()).resolves.toEqual([project]);
    await expect(client.project({ projectId: project.id })).resolves.toEqual(
      project,
    );
    expect(calls).toEqual(["account-1:Payment App"]);
  });

  test("maps the locked short code to a user-facing precondition failure", async () => {
    const projectShell: ProjectShellAccess = {
      create: async () => project,
      find: async () => project,
      list: async () => [project],
      recordFirstWork: async () => project,
      updateShortCode: () => Promise.reject(new ProjectShortCodeLockedError()),
    };
    const projectShellMutationContracts: ProjectShellMutationContracts = {
      create: () =>
        ({
          mutate: () =>
            Promise.reject(
              new Error("Project creation is not part of this test."),
            ),
        }) as MutationContract<ProjectShellMutationValue>,
      update: () =>
        ({
          mutate: () => Promise.reject(new ProjectShortCodeLockedError()),
        }) as MutationContract<ProjectShellMutationValue>,
    };
    const client = createRouterClient(appRouter, {
      context: createContext(projectShell, projectShellMutationContracts),
    });

    await expect(
      client.updateProjectShortCode({
        baseRevision: 1,
        clientIdempotencyKey: "update-project-1",
        projectId: project.id,
        shortCode: "PAYMENTS",
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: {
        code: "SHORT_CODE_LOCKED",
        label: "Short code is locked after the first Work.",
      },
      message: "Short code is locked after the first Work.",
      status: 412,
    });
  });

  test("enables a disabled Project area through the authenticated mutation", async () => {
    let currentProject = project;
    const projectShell: ProjectShellAccess = {
      create: async () => currentProject,
      find: async () => currentProject,
      list: async () => [currentProject],
      recordFirstWork: async () => currentProject,
      updateShortCode: async () => currentProject,
    };
    const updateMutation = createProjectUpdateMutation(
      () => currentProject,
      (nextProject) => {
        currentProject = nextProject;
      },
    );
    const projectShellMutationContracts: ProjectShellMutationContracts = {
      create: () => updateMutation,
      update: () => updateMutation,
    };
    const client = createRouterClient(appRouter, {
      context: createContext(projectShell, projectShellMutationContracts),
    });

    await expect(
      client.enableProjectArea({
        area: "Discovery",
        baseRevision: project.revision,
        clientIdempotencyKey: "enable-discovery-1",
        projectId: project.id,
      }),
    ).resolves.toMatchObject({
      configuration: expect.objectContaining({
        enabledAreas: ["Work", "Documents", "Discovery"],
      }),
      id: project.id,
      revision: project.revision + 1,
    });
  });

  test.each(["Work", "Documents"] as const)(
    "rejects pinning %s through the authenticated mutation",
    async (area) => {
      let currentProject = project;
      const projectShell: ProjectShellAccess = {
        create: async () => currentProject,
        find: async () => currentProject,
        list: async () => [currentProject],
        recordFirstWork: async () => currentProject,
        updateShortCode: async () => currentProject,
      };
      const updateMutation = createProjectUpdateMutation(
        () => currentProject,
        (nextProject) => {
          currentProject = nextProject;
        },
      );
      const client = createRouterClient(appRouter, {
        context: createContext(projectShell, {
          create: () => updateMutation,
          update: () => updateMutation,
        }),
      });

      await expect(
        client.updateProjectConfiguration({
          baseRevision: currentProject.revision,
          change: { area, kind: "pin-area" },
          clientIdempotencyKey: `pin-${area.toLowerCase()}-1`,
          projectId: currentProject.id,
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        data: { code: "PROJECT_CONFIGURATION_CHANGE_REJECTED" },
        message:
          "Work and Documents are already in the core Project navigation.",
        status: 400,
      });
      expect(currentProject).toBe(project);
    },
  );

  test("configures stages, area visibility, and status labels without changing semantics", async () => {
    let currentProject: ProjectProfile = {
      ...project,
      configuration: getProjectShellConfiguration("Solo SaaS"),
      starterConfiguration: "Solo SaaS",
    };
    const initialConfiguration = currentProject.configuration;
    const projectShell: ProjectShellAccess = {
      create: async () => currentProject,
      find: async () => currentProject,
      list: async () => [currentProject],
      recordFirstWork: async () => currentProject,
      updateShortCode: async () => currentProject,
    };
    const updateMutation = createProjectUpdateMutation(
      () => currentProject,
      (nextProject) => {
        currentProject = nextProject;
      },
    );
    const client = createRouterClient(appRouter, {
      context: createContext(projectShell, {
        create: () => updateMutation,
        update: () => updateMutation,
      }),
    });

    const update = (
      change: Parameters<typeof client.updateProjectConfiguration>[0]["change"],
    ) =>
      client.updateProjectConfiguration({
        baseRevision: currentProject.revision,
        change,
        clientIdempotencyKey: crypto.randomUUID(),
        projectId: currentProject.id,
      });

    const added = await update({
      kind: "add-stage",
      name: "Research",
      status: "Active",
    });
    expect(added.configuration.preparedStages).toContainEqual(
      expect.objectContaining({ name: "Research", status: "Active" }),
    );
    const researchStage = added.configuration.preparedStages.find(
      (stage) => stage.name === "Research",
    );
    if (!researchStage) {
      throw new Error("Expected the Research stage to be present.");
    }

    const withBuild = await update({
      kind: "add-stage",
      name: "Build",
      status: "Active",
    });
    const buildStage = withBuild.configuration.preparedStages.find(
      (stage) => stage.name === "Build",
    );
    if (!buildStage) {
      throw new Error("Expected the Build stage to be present.");
    }
    expect(
      withBuild.configuration.preparedStages.filter(
        (stage) => stage.status === "Active",
      ),
    ).toHaveLength(2);

    const renamed = await update({
      kind: "rename-stage",
      name: "Discovery research",
      stageId: researchStage.id,
    });
    expect(
      renamed.configuration.preparedStages.find(
        (stage) => stage.id === researchStage.id,
      ),
    ).toMatchObject({ name: "Discovery research", status: "Active" });

    const reordered = await update({
      kind: "reorder-stages",
      stageIds: [
        buildStage.id,
        researchStage.id,
        ...withBuild.configuration.preparedStages
          .filter(
            (stage) =>
              stage.id !== buildStage.id && stage.id !== researchStage.id,
          )
          .map((stage) => stage.id),
      ],
    });
    expect(
      reordered.configuration.preparedStages
        .slice(0, 2)
        .map((stage) => stage.name),
    ).toEqual(["Build", "Discovery research"]);

    const withCompletedBuild = await update({
      kind: "set-stage-status",
      stageId: buildStage.id,
      status: "Completed",
    });
    expect(
      withCompletedBuild.configuration.preparedStages.find(
        (stage) => stage.id === buildStage.id,
      ),
    ).toMatchObject({ name: "Build", status: "Completed" });

    const withoutBuild = await update({
      kind: "remove-stage",
      stageId: buildStage.id,
    });
    expect(
      withoutBuild.configuration.preparedStages.find(
        (stage) => stage.id === researchStage.id,
      ),
    ).toMatchObject({ name: "Discovery research", status: "Active" });
    expect(
      withoutBuild.configuration.preparedStages.some(
        (stage) => stage.id === buildStage.id,
      ),
    ).toBe(false);

    await update({
      area: "Discovery",
      kind: "set-area-visibility",
      visible: false,
    });
    await update({ area: "Discovery", kind: "unpin-area" });
    await update({ area: "Discovery", kind: "pin-area" });
    await update({
      areas: ["Decisions", "Discovery", "Design", "Tests", "Releases"],
      kind: "reorder-pinned-areas",
    });
    await update({
      kind: "rename-work-status",
      label: "Done",
      semantic: "Closed",
    });

    expect(currentProject.configuration.enabledAreas).toContain("Discovery");
    expect(currentProject.configuration.hiddenAreas).toContain("Discovery");
    expect(currentProject.configuration.workStatuses).toEqual([
      "Not Started",
      "In Progress",
      "Blocked",
      "Closed",
    ]);
    expect(currentProject.configuration.workStatusLabels).toContainEqual({
      label: "Done",
      semantic: "Closed",
    });

    const restored = await update({ kind: "restore-default-navigation" });
    expect(restored.configuration.extraPinnedAreas).toEqual(
      initialConfiguration.extraPinnedAreas,
    );
    expect(restored.configuration.hiddenAreas).toEqual(["Discovery"]);
    expect(restored.configuration.workStatusLabels).toContainEqual({
      label: "Done",
      semantic: "Closed",
    });
  });

  test("retries an automatically suggested Short code through the mutation contract", async () => {
    const attempts: string[] = [];
    let mutationAttempts = 0;
    const projectShell: ProjectShellAccess = {
      create: async () => project,
      find: async () => project,
      list: async () => [project],
      recordFirstWork: async () => project,
      updateShortCode: async () => project,
    };
    const createMutation: MutationContract<ProjectShellMutationValue> = {
      mutate: async <TPayload extends MutationPayload>(
        command: MutationCommand<TPayload>,
        apply: MutationApply<ProjectShellMutationValue, TPayload>,
      ) => {
        if (command.kind !== "human") {
          throw new Error("Expected a human Project command.");
        }
        const nextValue = await apply({
          currentRevision: 0,
          currentValue: { project: null },
          payload: command.payload,
        });
        const shortCode = nextValue.project?.shortCode;
        if (!shortCode) {
          throw new Error("Expected a Project short code.");
        }
        attempts.push(shortCode);
        mutationAttempts += 1;
        if (mutationAttempts === 1) {
          throw new ProjectShortCodeConflictError(shortCode);
        }
        return {
          actor: command.actor,
          committedAt: "2026-09-17T09:00:00.000Z",
          id: "receipt-1",
          nextValue,
          origin: {
            clientIdempotencyKey: command.clientIdempotencyKey,
            kind: "human" as const,
          },
          payloadFingerprint: "0".repeat(64),
          previousValue: { project: null },
          revision: 1,
          targetId: command.targetId,
        };
      },
    };
    const projectShellMutationContracts: ProjectShellMutationContracts = {
      create: () => createMutation,
      update: () => createMutation,
    };
    const client = createRouterClient(appRouter, {
      context: createContext(projectShell, projectShellMutationContracts),
    });

    await expect(
      client.createProject({
        baseRevision: 0,
        clientIdempotencyKey: "suggestion-retry-1",
        name: "Payment App",
        starterConfiguration: "Blank Project",
      }),
    ).resolves.toMatchObject({ shortCode: "PAY-2" });
    expect(attempts).toEqual(["PAY", "PAY-2"]);
  });
});
