import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { readJson, redactedFailure } from "./workspace-storage";

export const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
export const databaseKinds = ["primary", "security"] as const;
export type DatabaseKind = (typeof databaseKinds)[number];
export type Environment = Record<string, string | undefined>;
const fingerprintPattern = /^[a-f0-9]{64}$/;

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
  workspaceId: z.string().regex(/^[A-Za-z0-9-]{1,80}$/),
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
): Environment {
  if (environment.NEON_LOCAL === "true") {
    return applicationEnvironment(environment);
  }
  if (
    !(state && environment.CONDUCTOR_WORKSPACE_ID) ||
    state.archived ||
    state.workspaceId !== environment.CONDUCTOR_WORKSPACE_ID ||
    !config
  ) {
    throw new Error(
      "Run bun run db:workspace:setup for this Conductor workspace",
    );
  }
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
  if (!environment.CONDUCTOR_WORKSPACE_ID) {
    throw new Error(
      "CONDUCTOR_WORKSPACE_ID is required for owned Neon development; use db:workspace:setup or explicit disposable local mode",
    );
  }
  return workspaceEnvironment(
    environment,
    readWorkspaceState(),
    readDatabaseConfig(),
  );
}

export function workspaceStatePath(root = workspaceRoot) {
  return join(root, ".context/neon-workspace.json");
}
