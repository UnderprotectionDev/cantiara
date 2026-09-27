import { describe, expect, it } from "vitest";

import {
  assertArchiveWorkspaceRecord,
  assertBranch,
  assertConnection,
  assertDevelopmentBaseName,
  assertWorkspaceIdentity,
  assertWorkspaceRecord,
  bindLocalWorkspaceIdentity,
  branchName,
  neon,
  workspaceIdentity,
  workspacePort,
} from "./workspace-neon";

const expected = {
  projectId: "project-one",
  parentId: "br-base-one",
  branchId: "br-child-one",
  name: "ws-abc-primary",
  endpointId: "ep-child-one",
};
const localWorkspaceIdPattern = /^local-[a-f0-9]{32}$/;

describe("workspace Neon boundary", () => {
  it("derives a stable local identity when Conductor setup omits its workspace ID", () => {
    const root = process.cwd();
    const setupEnv = {
      CONDUCTOR_WORKSPACE_PATH: root,
      CONDUCTOR_ROOT_PATH: `${root}/..`,
      CONDUCTOR_PORT: "55070",
    };
    const id = workspaceIdentity(setupEnv, root);
    expect(id).toMatch(localWorkspaceIdPattern);
    expect(workspaceIdentity(setupEnv, root)).toBe(id);
    expect(
      workspaceIdentity({ ...setupEnv, CONDUCTOR_PORT: undefined }, root),
    ).toBe(id);
    expect(
      workspaceIdentity({ ...setupEnv, CONDUCTOR_WORKSPACE_ID: "abc" }, root),
    ).toBe("abc");
    expect(() =>
      assertWorkspaceIdentity(
        id,
        { ...setupEnv, CONDUCTOR_WORKSPACE_ID: "abc" },
        root,
      ),
    ).not.toThrow();
    expect(() =>
      assertWorkspaceIdentity(
        "local-00000000000000000000000000000000",
        setupEnv,
        root,
      ),
    ).toThrow();
    expect(() => assertWorkspaceIdentity("abc", setupEnv, root)).toThrow();
    const bound = bindLocalWorkspaceIdentity(
      { workspaceId: "abc", localWorkspaceId: undefined },
      { ...setupEnv, CONDUCTOR_WORKSPACE_ID: "abc" },
      root,
    );
    expect(bound.localWorkspaceId).toBe(id);
    expect(() =>
      assertWorkspaceIdentity("abc", setupEnv, root, bound.localWorkspaceId),
    ).not.toThrow();
    expect(() =>
      assertWorkspaceIdentity(
        "abc",
        { ...setupEnv, CONDUCTOR_WORKSPACE_PATH: `${root}/..` },
        root,
        bound.localWorkspaceId,
      ),
    ).toThrow();
  });

  it("does not derive a shared cloud identity from a generic checkout path", () => {
    const root = process.cwd();
    const cloudEnv = {
      CONDUCTOR_WORKSPACE_PATH: root,
      CONDUCTOR_ROOT_PATH: root,
    };
    expect(() => workspaceIdentity(cloudEnv, root)).toThrow();
    expect(() =>
      workspaceIdentity(
        { ...cloudEnv, CONDUCTOR_WORKSPACE_PATH: `${root}/..` },
        root,
      ),
    ).toThrow();
  });

  it("accepts versioned development bases", () => {
    expect(() => assertDevelopmentBaseName("development-base")).not.toThrow();
    expect(() =>
      assertDevelopmentBaseName("development-base-main-abcdef0"),
    ).not.toThrow();
    expect(() => assertDevelopmentBaseName("production")).toThrow();
  });

  it("archives a workspace from an explicitly retained base after renewal", () => {
    const state = {
      version: 2 as const,
      workspaceId: "abc",
      ownerNonce: "0123456789abcdef",
    };
    const record = {
      ...expected,
      name: branchName("abc", state.ownerNonce, "primary"),
    };
    const boundary = {
      projectId: expected.projectId,
      baseBranchId: "br-new-base",
      retainedBaseBranchIds: [expected.parentId],
      productionBranchId: "br-production",
    };
    expect(() =>
      assertWorkspaceRecord(record, state, "primary", boundary),
    ).toThrow();
    expect(() =>
      assertArchiveWorkspaceRecord(record, state, "primary", boundary),
    ).not.toThrow();
    expect(() =>
      assertArchiveWorkspaceRecord(
        { ...record, branchId: expected.parentId },
        state,
        "primary",
        boundary,
      ),
    ).toThrow();
    expect(() =>
      assertArchiveWorkspaceRecord(
        { ...record, parentId: "br-foreign" },
        state,
        "primary",
        boundary,
      ),
    ).toThrow();
  });
  it("rejects setup without a valid local Conductor port", () => {
    const previous = process.env.CONDUCTOR_PORT;
    try {
      for (const value of [undefined, "0", "65530", "abc"]) {
        if (value === undefined) {
          delete process.env.CONDUCTOR_PORT;
        } else {
          process.env.CONDUCTOR_PORT = value;
        }
        expect(() => workspacePort()).toThrow();
      }
      process.env.CONDUCTOR_PORT = "55070";
      expect(workspacePort()).toBe(55_070);
    } finally {
      if (previous === undefined) {
        delete process.env.CONDUCTOR_PORT;
      } else {
        process.env.CONDUCTOR_PORT = previous;
      }
    }
  });
  it("uses the workspace identity rather than an issue number", () => {
    expect(branchName("abc", "0123456789abcdef", "primary")).toBe(
      "ws-abc-0123456789abcdef-primary",
    );
    expect(branchName("def", "0123456789abcdef", "primary")).toBe(
      "ws-def-0123456789abcdef-primary",
    );
  });

  it("rejects another project, parent, branch, production, or protected branch", () => {
    const branch = {
      id: expected.branchId,
      project_id: expected.projectId,
      parent_id: expected.parentId,
      name: expected.name,
      primary: false,
      protected: false,
    };
    expect(() => assertBranch(branch, expected)).not.toThrow();
    for (const change of [
      { project_id: "other" },
      { parent_id: "other" },
      { id: "other" },
      { name: "production" },
      { primary: true },
      { protected: true },
    ]) {
      expect(() => assertBranch({ ...branch, ...change }, expected)).toThrow();
    }
  });

  it("rejects a forged workspace record before migration", () => {
    const state = {
      version: 2 as const,
      workspaceId: "abc",
      ownerNonce: "0123456789abcdef",
    };
    const record = {
      ...expected,
      name: branchName("abc", state.ownerNonce, "primary"),
    };
    const boundary = {
      projectId: expected.projectId,
      baseBranchId: expected.parentId,
      productionBranchId: "br-production",
    };
    expect(() =>
      assertWorkspaceRecord(record, state, "primary", boundary),
    ).not.toThrow();
    for (const change of [
      { projectId: "foreign-project" },
      { parentId: "br-foreign-base" },
      { branchId: "br-production" },
      { name: "ws-someone-else-primary" },
    ]) {
      expect(() =>
        assertWorkspaceRecord(
          { ...record, ...change },
          state,
          "primary",
          boundary,
        ),
      ).toThrow();
    }
  });

  it("rejects an absent, foreign, or pooled endpoint in direct migration URLs", () => {
    const direct = "postgresql://role:secret@ep-child-one.eu.neon.tech/neondb";
    const pooled =
      "postgresql://role:secret@ep-child-one-pooler.eu.neon.tech/neondb";
    expect(() =>
      assertConnection(direct, expected.endpointId, false),
    ).not.toThrow();
    expect(() =>
      assertConnection(pooled, expected.endpointId, true),
    ).not.toThrow();
    expect(() =>
      assertConnection(undefined, expected.endpointId, false),
    ).toThrow();
    expect(() =>
      assertConnection(pooled, expected.endpointId, false),
    ).toThrow();
    expect(() =>
      assertConnection(
        direct.replace("ep-child-one", "ep-other"),
        expected.endpointId,
        false,
      ),
    ).toThrow();
  });

  it("fails closed and redacts CLI failures such as access denial or branch quota", async () => {
    await expect(
      neon(["branches", "create"], "/usr/bin/false"),
    ).rejects.toThrow("Neon command failed");
    await expect(
      neon(["branches", "create"], "/missing/neonctl"),
    ).rejects.toThrow("Neon command is unavailable");
  });
});
