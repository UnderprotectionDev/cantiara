import type { NeonApi, NeonBranch } from "./neon-api";
import {
  assertWorkspaceConnection,
  assertWorkspaceRecord,
  type DatabaseConfig,
  type DatabaseKind,
  databaseKinds,
  developmentBaseName,
  forEachDatabase,
  type ProjectBoundary,
  type WorkspaceRecord,
  type WorkspaceState,
  workspaceBranchName,
} from "./workspace-database";

export type WorkspaceClients = Record<
  DatabaseKind,
  Pick<
    NeonApi,
    | "getBranch"
    | "findBranch"
    | "createBranch"
    | "endpoint"
    | "connection"
    | "deleteBranch"
  >
>;
interface LifecycleOptions {
  clients: WorkspaceClients;
  config: DatabaseConfig;
  save: () => Promise<void>;
  state: WorkspaceState;
  verify: (kind: DatabaseKind, record: WorkspaceRecord) => Promise<void>;
}

export function assertDevelopmentBranch(
  branch: NeonBranch | undefined,
  boundary: ProjectBoundary,
) {
  if (
    !branch ||
    branch.id !== boundary.developmentBranchId ||
    branch.project_id !== boundary.projectId ||
    branch.id === boundary.productionBranchId ||
    branch.default !== false ||
    branch.primary ||
    branch.protected !== false ||
    branch.parent_id !== undefined ||
    !["schema-only", "parent-schema"].includes(branch.init_source ?? "") ||
    branch.current_state !== "ready" ||
    !branch.name.startsWith("cantiara-development-")
  ) {
    throw new Error("Canonical development database ownership is invalid");
  }
  return branch;
}

export function assertDevelopmentBase(
  branch: NeonBranch | undefined,
  boundary: ProjectBoundary,
  fingerprint: string,
) {
  if (
    !branch ||
    branch.project_id !== boundary.projectId ||
    branch.parent_id !== boundary.developmentBranchId ||
    branch.id === boundary.productionBranchId ||
    branch.id === boundary.developmentBranchId ||
    branch.default !== false ||
    branch.primary ||
    branch.name !== developmentBaseName(fingerprint) ||
    branch.current_state !== "ready"
  ) {
    throw new Error(
      "Verified canonical baseline is unavailable; publish main first",
    );
  }
  return branch;
}

export function assertOwnedBranch(branch: NeonBranch, record: WorkspaceRecord) {
  if (
    branch.id !== record.branchId ||
    branch.project_id !== record.projectId ||
    branch.parent_id !== record.parentId ||
    branch.name !== record.name ||
    branch.default !== false ||
    branch.primary ||
    branch.protected !== false ||
    branch.current_state !== "ready"
  ) {
    throw new Error("Neon branch ownership differs; no branch was changed");
  }
}

export async function provisionWorkspace({
  state,
  config,
  clients,
  save,
  verify,
}: LifecycleOptions) {
  if (state.archived) {
    throw new Error(
      "Archived workspace cannot provision replacement databases",
    );
  }
  await forEachDatabase(async (kind) => {
    const boundary = config[kind];
    const client = clients[kind];
    assertDevelopmentBranch(
      await client.getBranch(boundary.developmentBranchId ?? ""),
      boundary,
    );
    const base = assertDevelopmentBase(
      await client.findBranch(
        developmentBaseName(state.baselineFingerprints[kind]),
      ),
      boundary,
      state.baselineFingerprints[kind],
    );
    const existing = state[kind];
    const name = workspaceBranchName(state, kind);
    if (existing) {
      assertWorkspaceRecord(state, kind, boundary);
      if (existing.parentId !== base.id) {
        throw new Error(
          "Workspace baseline differs; do not reset an active branch",
        );
      }
    }
    const branch = existing
      ? await client.getBranch(existing.branchId)
      : ((await client.findBranch(name)) ??
        (await client.createBranch(name, base.id)));
    if (!branch) {
      throw new Error(
        "Owned workspace branch disappeared; do not recreate it silently",
      );
    }
    const endpoint = await client.endpoint(branch.id);
    const record: WorkspaceRecord = existing ?? {
      projectId: boundary.projectId,
      branchId: branch.id,
      parentId: base.id,
      name,
      endpointId: endpoint.id,
      verified: false,
    };
    assertOwnedBranch(branch, record);
    if (endpoint.id !== record.endpointId) {
      throw new Error("Workspace compute changed; no connection was replaced");
    }
    state[kind] = record;
    await save();
    record.connection = await client.connection(
      record.branchId,
      record.endpointId,
      boundary.databaseName,
      boundary.roleName,
    );
    assertWorkspaceConnection(record.connection, record, boundary);
    if (!record.verified) {
      await verify(kind, record);
      record.verified = true;
    }
    await save();
  });
}

export async function bootstrapDevelopment({
  state,
  config,
  clients,
  save,
  migrate,
  saveConfiguration,
}: {
  state: WorkspaceState;
  config: DatabaseConfig;
  clients: Record<
    DatabaseKind,
    WorkspaceClients[DatabaseKind] &
      Pick<NeonApi, "ensureEmptyDatabase" | "assertDatabaseAbsent">
  >;
  save: () => Promise<void>;
  migrate: () => Promise<void>;
  saveConfiguration: () => Promise<void>;
}) {
  if (
    state.workspaceId !== "bootstrap" ||
    state.archived ||
    databaseKinds.some((kind) => config[kind].developmentBranchId)
  ) {
    throw new Error(
      "Development targets already configured or bootstrap ownership differs",
    );
  }
  await forEachDatabase(async (kind) => {
    const boundary = config[kind];
    const production = await clients[kind].getBranch(
      boundary.productionBranchId,
    );
    if (
      !production ||
      production.id !== boundary.productionBranchId ||
      production.project_id !== boundary.projectId ||
      production.default !== true
    ) {
      throw new Error(
        "Configured production source differs; no bootstrap resource was created",
      );
    }
    await clients[kind].assertDatabaseAbsent(
      boundary.productionBranchId,
      boundary.databaseName,
    );
  });
  await forEachDatabase(async (kind) => {
    const boundary = config[kind];
    const name = `cantiara-development-${state.ownerNonce}-${kind}`;
    const recorded = state[kind];
    if (
      recorded &&
      (recorded.projectId !== boundary.projectId ||
        recorded.parentId !== boundary.productionBranchId ||
        recorded.name !== name)
    ) {
      throw new Error(
        "Bootstrap receipt ownership differs; no resources were replaced",
      );
    }
    const branch = recorded
      ? await clients[kind].getBranch(recorded.branchId)
      : ((await clients[kind].findBranch(name)) ??
        (await clients[kind].createBranch(
          name,
          boundary.productionBranchId,
          true,
        )));
    if (!branch) {
      throw new Error(
        "Bootstrap branch disappeared; do not recreate it silently",
      );
    }
    assertDevelopmentBranch(branch, {
      ...boundary,
      developmentBranchId: branch.id,
    });
    if (branch.name !== name) {
      throw new Error(
        "Bootstrap branch identity is invalid; production remains untouched",
      );
    }
    const endpoint = await clients[kind].endpoint(branch.id);
    if (recorded && endpoint.id !== recorded.endpointId) {
      throw new Error("Bootstrap compute changed; no connection was replaced");
    }
    state[kind] = recorded ?? {
      projectId: boundary.projectId,
      branchId: branch.id,
      parentId: boundary.productionBranchId,
      endpointId: endpoint.id,
      name,
      verified: false,
    };
    await save();
    await clients[kind].ensureEmptyDatabase(
      branch.id,
      boundary.databaseName,
      boundary.roleName,
    );
    boundary.developmentBranchId = branch.id;
  });
  await migrate();
  await saveConfiguration();
}

export async function archiveWorkspace({
  state,
  config,
  clients,
  save,
}: Omit<LifecycleOptions, "verify">) {
  if (state.archived) {
    return;
  }
  await forEachDatabase(async (kind) => {
    if (!state[kind]) {
      return;
    }
    const record = assertWorkspaceRecord(state, kind, config[kind]);
    const branch = await clients[kind].getBranch(record.branchId);
    if (branch) {
      assertOwnedBranch(branch, record);
      assertDevelopmentBase(
        await clients[kind].getBranch(record.parentId),
        config[kind],
        state.baselineFingerprints[kind],
      );
      const endpoint = await clients[kind].endpoint(record.branchId);
      if (endpoint.id !== record.endpointId) {
        throw new Error("Workspace compute changed; no branch was deleted");
      }
    }
  });
  await forEachDatabase(async (kind) => {
    if (!state[kind]) {
      return;
    }
    const record = assertWorkspaceRecord(state, kind, config[kind]);
    const branch = await clients[kind].getBranch(record.branchId);
    if (branch) {
      assertOwnedBranch(branch, record);
      const endpoint = await clients[kind].endpoint(record.branchId);
      if (endpoint.id !== record.endpointId) {
        throw new Error("Workspace compute changed; no branch was deleted");
      }
      await clients[kind].deleteBranch(record.branchId);
    }
  });
  state.archived = true;
  for (const kind of databaseKinds) {
    const record = state[kind];
    if (record) {
      record.connection = undefined;
    }
  }
  await save();
}
