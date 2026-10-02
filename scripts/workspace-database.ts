import { createHash, randomBytes } from "node:crypto";
import { existsSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { git } from "./migration-baseline";
import { readJson, redactedFailure } from "./workspace-storage";

export const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
export const databaseKinds = ["primary", "security"] as const;
export type DatabaseKind = (typeof databaseKinds)[number];
export type Environment = Record<string, string | undefined>;
const fingerprintPattern = /^[a-f0-9]{64}$/;
const workspaceIdPattern = /^[A-Za-z0-9-]{1,80}$/;
const workspaceLocationPattern = /^path-[a-f0-9]{40}$/;

export async function forEachDatabase(
  action: (kind: DatabaseKind) => Promise<void>,
) {
  await action("primary");
  await action("security");
}

export function applicationEnvironment(environment: Environment): Environment {
  return {
    ...environment,
    NEON_API_KEY: undefined,
    NEON_SECURITY_API_KEY: undefined,
  };
}

const identifier = z.string().regex(/^[a-z0-9-]{1,80}$/);
const branchId = z.string().regex(/^br-[a-z0-9-]+$/);
const boundarySchema = z.object({
  projectId: identifier,
  productionBranchId: branchId,
  developmentBranchId: branchId.nullable(),
  databaseName: z.string().regex(/^[a-z][a-z0-9_]{1,62}$/),
  roleName: z.string().regex(/^[a-z][a-z0-9_]{1,62}$/),
});
const configSchema = z.object({
  version: z.literal(1),
  primary: boundarySchema,
  security: boundarySchema,
});
export type DatabaseConfig = z.infer<typeof configSchema>;
export type ProjectBoundary = z.infer<typeof boundarySchema>;

const recordSchema = z.object({
  projectId: identifier,
  branchId,
  parentId: branchId,
  endpointId: z.string().regex(/^ep-[a-z0-9-]+$/),
  name: z.string(),
  verified: z.boolean(),
  connection: z.string().optional(),
});
const stateSchema = z.object({
  version: z.literal(1),
  workspaceId: z.string().regex(workspaceIdPattern),
  workspaceLocation: z.string().regex(workspaceLocationPattern).optional(),
  ownerNonce: z.string().regex(/^[a-f0-9]{24}$/),
  baselineCommit: z.string().regex(/^[a-f0-9]{40}$/),
  baselineFingerprints: z.object({
    primary: z.string().regex(/^[a-f0-9]{64}$/),
    security: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  primary: recordSchema.optional(),
  security: recordSchema.optional(),
  archived: z.boolean().optional(),
});
export type WorkspaceState = z.infer<typeof stateSchema>;
export type WorkspaceRecord = z.infer<typeof recordSchema>;

function resolveWorkspaceLocation(environment: Environment, root: string) {
  const repositoryPath = environment.CONDUCTOR_ROOT_PATH;
  const workspacePath = environment.CONDUCTOR_WORKSPACE_PATH;
  if (!(repositoryPath || workspacePath)) {
    return;
  }
  if (
    !(
      repositoryPath &&
      workspacePath &&
      isAbsolute(repositoryPath) &&
      isAbsolute(workspacePath)
    )
  ) {
    throw new Error(
      "CONDUCTOR_ROOT_PATH and CONDUCTOR_WORKSPACE_PATH must identify this Git worktree",
    );
  }
  try {
    const repository = realpathSync(repositoryPath);
    const workspace = realpathSync(workspacePath);
    const commonDirectory = realpathSync(
      git(
        repository,
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
      ),
    );
    if (
      workspace !== realpathSync(root) ||
      workspace === repository ||
      realpathSync(git(workspace, "rev-parse", "--show-toplevel")) !==
        workspace ||
      realpathSync(git(repository, "rev-parse", "--show-toplevel")) !==
        repository ||
      realpathSync(
        git(
          workspace,
          "rev-parse",
          "--path-format=absolute",
          "--git-common-dir",
        ),
      ) !== commonDirectory
    ) {
      throw new Error(
        "Workspace paths do not identify an isolated worktree of this repository",
      );
    }
    const worktreeDirectory = realpathSync(
      git(workspace, "rev-parse", "--absolute-git-dir"),
    );
    const incarnation = statSync(worktreeDirectory);
    return `path-${createHash("sha256")
      .update("cantiara-workspace-location-v1\0")
      .update(
        JSON.stringify([
          commonDirectory,
          workspace,
          worktreeDirectory,
          incarnation.dev,
          incarnation.ino,
          incarnation.birthtimeMs,
        ]),
      )
      .digest("hex")
      .slice(0, 40)}`;
  } catch (error) {
    throw redactedFailure(
      "Invalid Conductor workspace paths; use this workspace's Setup environment",
      error,
    );
  }
}

export function resolveWorkspaceIdentity(
  environment: Environment,
  state?: WorkspaceState,
  root = workspaceRoot,
) {
  const workspaceLocation = resolveWorkspaceLocation(environment, root);
  const nativeId = environment.CONDUCTOR_WORKSPACE_ID;
  if (state?.workspaceLocation) {
    if (!workspaceLocation) {
      throw new Error(
        "Conductor workspace paths are required to verify location-bound database state; provide CONDUCTOR_ROOT_PATH and CONDUCTOR_WORKSPACE_PATH",
      );
    }
    if (state.workspaceLocation !== workspaceLocation) {
      throw new Error(
        "Copied database state belongs to a different Conductor workspace",
      );
    }
    return { workspaceId: state.workspaceId, workspaceLocation };
  }
  const workspaceId =
    state && nativeId === state.workspaceId
      ? nativeId
      : (workspaceLocation ?? nativeId);
  if (!(workspaceId && workspaceIdPattern.test(workspaceId))) {
    throw new Error(
      "Conductor workspace identity is required; provide CONDUCTOR_ROOT_PATH and CONDUCTOR_WORKSPACE_PATH, or use explicit disposable local mode",
    );
  }
  if (state && state.workspaceId !== workspaceId) {
    throw new Error(
      "Copied database state belongs to a different Conductor workspace; legacy state requires its original CONDUCTOR_WORKSPACE_ID for one Setup run",
    );
  }
  return { workspaceId, workspaceLocation };
}

export function parseDatabaseConfig(value: unknown): DatabaseConfig {
  const parsed = configSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid .conductor/neon.json configuration");
  }
  const config = parsed.data;
  if (config.primary.projectId === config.security.projectId) {
    throw new Error("Primary and security databases require separate projects");
  }
  for (const kind of databaseKinds) {
    const boundary = config[kind];
    if (boundary.developmentBranchId === boundary.productionBranchId) {
      throw new Error("Development target must not be production");
    }
  }
  return config;
}

export function readDatabaseConfig(root = workspaceRoot) {
  return parseDatabaseConfig(readJson(join(root, ".conductor/neon.json")));
}

export function parseWorkspaceState(value: unknown): WorkspaceState {
  const parsed = stateSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid workspace database state; credentials redacted");
  }
  return parsed.data;
}

export function readWorkspaceState(root = workspaceRoot) {
  const stateFile = join(root, ".context/neon-workspace.json");
  return existsSync(stateFile)
    ? parseWorkspaceState(readJson(stateFile))
    : undefined;
}

export function newWorkspaceState(
  workspaceId: string,
  baselineCommit: string,
  baselineFingerprints: WorkspaceState["baselineFingerprints"],
): WorkspaceState {
  return parseWorkspaceState({
    version: 1,
    workspaceId,
    ownerNonce: randomBytes(12).toString("hex"),
    baselineCommit,
    baselineFingerprints,
  });
}

export function workspaceBranchName(state: WorkspaceState, kind: DatabaseKind) {
  return `cantiara-ws-${state.workspaceId.toLowerCase()}-${state.ownerNonce}-${kind}`;
}

export function developmentBaseName(fingerprint: string) {
  if (!fingerprintPattern.test(fingerprint)) {
    throw new Error("Invalid development baseline fingerprint");
  }
  return `cantiara-base-${fingerprint}`;
}

export function assertWorkspaceRecord(
  state: WorkspaceState,
  kind: DatabaseKind,
  boundary: ProjectBoundary,
) {
  const record = state[kind];
  if (
    !record ||
    record.projectId !== boundary.projectId ||
    record.branchId === boundary.productionBranchId ||
    record.branchId === boundary.developmentBranchId ||
    record.branchId === record.parentId ||
    record.name !== workspaceBranchName(state, kind)
  ) {
    throw new Error(
      "Workspace database ownership does not match configuration",
    );
  }
  return record;
}

export function assertWorkspaceConnection(
  connection: string,
  record: WorkspaceRecord,
  boundary: ProjectBoundary,
) {
  let target: URL;
  try {
    target = new URL(connection);
  } catch (error) {
    throw redactedFailure(
      "Invalid workspace connection; credentials redacted",
      error,
    );
  }
  if (
    !(
      ["postgres:", "postgresql:"].includes(target.protocol) &&
      target.hostname.startsWith(`${record.endpointId}.`) &&
      target.hostname.endsWith(".neon.tech")
    ) ||
    decodeURIComponent(target.pathname.slice(1)) !== boundary.databaseName ||
    decodeURIComponent(target.username) !== boundary.roleName ||
    !target.password ||
    (target.port !== "" && target.port !== "5432")
  ) {
    throw new Error("Workspace connection target differs from owned endpoint");
  }
}

export function workspaceEnvironment(
  environment: Environment,
  state: WorkspaceState | undefined,
  config?: DatabaseConfig,
  root = workspaceRoot,
): Environment {
  if (environment.NEON_LOCAL === "true") {
    return applicationEnvironment(environment);
  }
  if (!state || state.archived || !config) {
    throw new Error(
      "Run bun run db:workspace:setup for this Conductor workspace",
    );
  }
  const identity = resolveWorkspaceIdentity(environment, state, root);
  const connections: string[] = [];
  for (const kind of databaseKinds) {
    const record = assertWorkspaceRecord(state, kind, config[kind]);
    if (!(record.verified && record.connection)) {
      throw new Error(
        "Incomplete database setup; run bun run db:workspace:setup",
      );
    }
    assertWorkspaceConnection(record.connection, record, config[kind]);
    connections.push(record.connection);
  }
  const [primary, security] = connections;
  return {
    ...applicationEnvironment(environment),
    CONDUCTOR_WORKSPACE_ID: identity.workspaceId,
    DATABASE_URL: primary,
    DATABASE_URL_UNPOOLED: primary,
    SECURITY_EVENT_DATABASE_URL: security,
    SECURITY_EVENT_DATABASE_URL_UNPOOLED: security,
    SECURITY_EVENT_LOCAL: "false",
    NEON_API_KEY: undefined,
    NEON_SECURITY_API_KEY: undefined,
  };
}

export function loadWorkspaceEnvironment(environment: Environment) {
  if (environment.NEON_LOCAL === "true") {
    return applicationEnvironment(environment);
  }
  const state = readWorkspaceState();
  return workspaceEnvironment(environment, state, readDatabaseConfig());
}

export function workspaceStatePath(root = workspaceRoot) {
  return join(root, ".context/neon-workspace.json");
}
