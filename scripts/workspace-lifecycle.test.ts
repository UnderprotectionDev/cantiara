import { describe, expect, it, vi } from "vitest";
import type { NeonBranch } from "./neon-api";
import {
  type DatabaseConfig,
  developmentBaseName,
  newWorkspaceState,
  type WorkspaceState,
} from "./workspace-database";
import {
  archiveWorkspace,
  bootstrapDevelopment,
  provisionWorkspace,
} from "./workspace-lifecycle";

const fingerprints = { primary: "a".repeat(64), security: "b".repeat(64) };
const config: DatabaseConfig = {
  version: 1,
  primary: {
    projectId: "project-primary",
    productionBranchId: "br-production-primary",
    developmentBranchId: "br-development-primary",
    databaseName: "cantiara_development",
    roleName: "primary_owner",
  },
  security: {
    projectId: "project-security",
    productionBranchId: "br-production-security",
    developmentBranchId: "br-development-security",
    databaseName: "cantiara_development",
    roleName: "security_owner",
  },
};

function fixture() {
  const branches = new Map<string, NeonBranch>();
  const state = newWorkspaceState(
    "workspace-one",
    "c".repeat(40),
    fingerprints,
  );
  const saved: WorkspaceState[] = [];
  let denySecurity = false;
  const clients = Object.fromEntries(
    (["primary", "security"] as const).map((kind) => {
      const boundary = config[kind];
      const base: NeonBranch = {
        id: `br-base-${kind}`,
        project_id: boundary.projectId,
        parent_id: boundary.developmentBranchId ?? undefined,
        name: developmentBaseName(fingerprints[kind]),
        default: false,
        protected: false,
        current_state: "ready",
      };
      const development: NeonBranch = {
        id: boundary.developmentBranchId ?? "",
        project_id: boundary.projectId,
        name: `cantiara-development-${kind}`,
        default: false,
        protected: false,
        current_state: "ready",
        init_source: "parent-schema",
      };
      branches.set(base.id, base);
      branches.set(development.id, development);
      return [
        kind,
        {
          getBranch: async (id: string) => branches.get(id),
          findBranch: async (name: string) =>
            [...branches.values()].find((branch) => branch.name === name),
          createBranch: (name: string, parentId: string) => {
            if (kind === "security" && denySecurity) {
              return Promise.reject(
                new Error("Security project temporarily unavailable"),
              );
            }
            const branch = {
              id: `br-workspace-${kind}`,
              project_id: boundary.projectId,
              parent_id: parentId,
              name,
              default: false,
              protected: false,
              current_state: "ready",
            };
            branches.set(branch.id, branch);
            return Promise.resolve(branch);
          },
          endpoint: async (id: string) => ({
            id: `ep-${id.slice(3)}`,
            project_id: boundary.projectId,
            branch_id: id,
            type: "read_write",
          }),
          connection: async (_id: string, endpoint: string) =>
            `postgresql://${boundary.roleName}:password@${endpoint}.eu.neon.tech/${boundary.databaseName}`,
          deleteBranch: (id: string) => {
            branches.delete(id);
            return Promise.resolve();
          },
        },
      ];
    }),
  );
  return {
    branches,
    state,
    saved,
    denySecurity: () => {
      denySecurity = true;
    },
    allowSecurity: () => {
      denySecurity = false;
    },
    options: {
      state,
      config,
      clients: clients as Parameters<typeof provisionWorkspace>[0]["clients"],
      save: () => {
        saved.push(structuredClone(state));
        return Promise.resolve();
      },
      verify: () => Promise.resolve(),
    },
  };
}

describe("workspace database lifecycle", () => {
  it.each([
    (branch: NeonBranch) => {
      Reflect.deleteProperty(branch, "default");
    },
    (branch: NeonBranch) => {
      branch.parent_id = "br-production-primary";
    },
    (branch: NeonBranch) => {
      branch.init_source = "parent-data";
    },
  ])(
    "rejects missing safety metadata and reparented canonical databases",
    async (change) => {
      const setup = fixture();
      const branch = setup.branches.get("br-development-primary");
      if (branch) {
        change(branch);
      }
      await expect(provisionWorkspace(setup.options)).rejects.toThrow(
        "ownership",
      );
      expect(setup.state.primary).toBeUndefined();
    },
  );

  it("checks both recorded endpoints before deleting either workspace branch", async () => {
    const setup = fixture();
    await provisionWorkspace(setup.options);
    setup.options.clients.security.endpoint = (id: string) =>
      Promise.resolve({
        id: "ep-reassigned",
        project_id: config.security.projectId,
        branch_id: id,
        type: "read_write",
      });
    await expect(archiveWorkspace(setup.options)).rejects.toThrow(
      "compute changed",
    );
    expect(setup.branches.has("br-workspace-primary")).toBe(true);
    expect(setup.branches.has("br-workspace-security")).toBe(true);
  });

  it("resumes a failed bootstrap without publishing config or replacing owned resources", async () => {
    const setup = fixture();
    const bootstrapConfig = structuredClone(config);
    bootstrapConfig.primary.developmentBranchId = null;
    bootstrapConfig.security.developmentBranchId = null;
    setup.state.workspaceId = "bootstrap";
    for (const kind of ["primary", "security"] as const) {
      setup.branches.set(config[kind].productionBranchId, {
        id: config[kind].productionBranchId,
        project_id: config[kind].projectId,
        name: "production",
        default: true,
        protected: false,
        current_state: "ready",
      });
      setup.options.clients[kind].createBranch = (name: string) => {
        const branch = {
          id: `br-bootstrap-${kind}`,
          project_id: config[kind].projectId,
          name,
          default: false,
          protected: false,
          current_state: "ready",
          init_source: "parent-schema",
        };
        setup.branches.set(branch.id, branch);
        return Promise.resolve(branch);
      };
    }
    let published = false;
    const migrate = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("Migration failed"))
      .mockResolvedValue(undefined);
    const options: Parameters<typeof bootstrapDevelopment>[0] = {
      ...setup.options,
      config: bootstrapConfig,
      clients: {
        primary: {
          ...setup.options.clients.primary,
          ensureEmptyDatabase: () => Promise.resolve(),
          assertDatabaseAbsent: () => Promise.resolve(),
        },
        security: {
          ...setup.options.clients.security,
          ensureEmptyDatabase: () => Promise.resolve(),
          assertDatabaseAbsent: () => Promise.resolve(),
        },
      },
      migrate,
      saveConfiguration: () => {
        published = true;
        return Promise.resolve();
      },
    };
    await expect(bootstrapDevelopment(options)).rejects.toThrow(
      "Migration failed",
    );
    expect(published).toBe(false);
    const primaryId = setup.state.primary?.branchId;
    bootstrapConfig.primary.developmentBranchId = null;
    bootstrapConfig.security.developmentBranchId = null;
    await bootstrapDevelopment(options);
    expect(published).toBe(true);
    expect(setup.state.primary?.branchId).toBe(primaryId);
    expect(setup.branches.size).toBe(8);
  });
  it("keeps a successful primary branch when security fails and resumes without replacement", async () => {
    const setup = fixture();
    setup.denySecurity();
    await expect(provisionWorkspace(setup.options)).rejects.toThrow(
      "temporarily unavailable",
    );
    const primaryId = setup.state.primary?.branchId;
    expect(primaryId).toBe("br-workspace-primary");
    expect(setup.saved.at(-1)?.primary?.verified).toBe(true);
    setup.allowSecurity();
    await provisionWorkspace(setup.options);
    expect(setup.state.primary?.branchId).toBe(primaryId);
    expect(setup.state.security?.verified).toBe(true);
    expect(setup.branches.size).toBe(6);
  });

  it.each(["default", "protected"] as const)(
    "does not delete either database when a record becomes %s",
    async (flag) => {
      const setup = fixture();
      await provisionWorkspace(setup.options);
      const security = setup.branches.get("br-workspace-security");
      if (security) {
        security[flag] = true;
      }
      await expect(archiveWorkspace(setup.options)).rejects.toThrow(
        "ownership",
      );
      expect(setup.branches.has("br-workspace-primary")).toBe(true);
      expect(setup.branches.has("br-workspace-security")).toBe(true);
    },
  );

  it("never marks a malformed baseline as verified", async () => {
    const setup = fixture();
    setup.options.verify = () =>
      Promise.reject(new Error("Baseline history is ahead"));
    await expect(provisionWorkspace(setup.options)).rejects.toThrow(
      "history is ahead",
    );
    expect(setup.state.primary?.verified).toBe(false);
    expect(setup.state.security).toBeUndefined();
  });

  it("does not silently replace a deleted workspace branch", async () => {
    const setup = fixture();
    await provisionWorkspace(setup.options);
    setup.branches.delete("br-workspace-primary");
    await expect(provisionWorkspace(setup.options)).rejects.toThrow(
      "disappeared",
    );
    expect(setup.branches.has("br-workspace-primary")).toBe(false);
  });

  it("rejects a base that was replaced by a production branch", async () => {
    const setup = fixture();
    const base = setup.branches.get("br-base-primary");
    if (base) {
      base.default = true;
    }
    await expect(provisionWorkspace(setup.options)).rejects.toThrow(
      "baseline is unavailable",
    );
    expect(setup.state.primary).toBeUndefined();
  });

  it("continues a partially completed archive without recreating the first branch", async () => {
    const setup = fixture();
    await provisionWorkspace(setup.options);
    const remove = setup.options.clients.security.deleteBranch;
    setup.options.clients.security.deleteBranch = () =>
      Promise.reject(new Error("Deletion timed out"));
    await expect(archiveWorkspace(setup.options)).rejects.toThrow("timed out");
    expect(setup.state.archived).not.toBe(true);
    expect(setup.branches.has("br-workspace-primary")).toBe(false);
    setup.options.clients.security.deleteBranch = remove;
    await archiveWorkspace(setup.options);
    await archiveWorkspace(setup.options);
    expect(setup.state.archived).toBe(true);
    expect(setup.state.primary?.connection).toBeUndefined();
    expect(setup.branches.size).toBe(4);
  });
});
