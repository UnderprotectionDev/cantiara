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
    const projectShell: ProjectShellAccess = {
      create: async () => project,
      find: async () => project,
      list: async () => [project],
      recordFirstWork: async () => project,
      updateShortCode: async () => project,
    };
    const updateMutation: MutationContract<ProjectShellMutationValue> = {
      mutate: async <TPayload extends MutationPayload>(
        command: MutationCommand<TPayload>,
        apply: MutationApply<ProjectShellMutationValue, TPayload>,
      ) => {
        if (command.kind !== "human") {
          throw new Error("Expected a human Project command.");
        }
        const nextValue = await apply({
          currentRevision: project.revision,
          currentValue: { project },
          payload: command.payload,
        });
        return {
          actor: command.actor,
          committedAt: "2026-09-17T09:00:00.000Z",
          id: "receipt-2",
          nextValue,
          origin: {
            clientIdempotencyKey: command.clientIdempotencyKey,
            kind: "human" as const,
          },
          payloadFingerprint: "0".repeat(64),
          previousValue: { project },
          revision: nextValue.project?.revision ?? project.revision,
          targetId: command.targetId,
        };
      },
    };
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
