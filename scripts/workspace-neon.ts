import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface BranchRecord {
  branchId: string;
  endpointId: string;
  name: string;
  parentId: string;
  projectId: string;
}

export interface ProjectBoundary {
  baseBranchId: string;
  productionBranchId: string;
  projectId: string;
  retainedBaseBranchIds?: string[];
}

export interface WorkspaceState {
  connections?: {
    primary: { direct: string; pooled: string };
    security: { direct: string; pooled: string };
  };
  localWorkspaceId?: string;
  ownerNonce: string;
  primary?: BranchRecord;
  security?: BranchRecord;
  version: 2;
  workspaceId: string;
}

interface NeonBranch {
  id: string;
  name: string;
  parent_id?: string;
  primary?: boolean;
  project_id: string;
  protected?: boolean;
}

const workspaceIdPattern = /^[a-zA-Z0-9-]{1,80}$/;
const ownerNoncePattern = /^[a-f0-9]{16}$/;
const localWorkspaceIdPattern = /^local-[a-f0-9]{24}(?:[a-f0-9]{8})?$/;
const protectedBranchNamePattern =
  /^(main|master|production|shared|development|dev)$/i;
const developmentBaseNamePattern = /^development-base(?:-[a-z0-9][a-z0-9-]*)?$/;

type WorkspaceIdentityEnv = Record<string, string | undefined>;

export function assertDevelopmentBaseName(name: string) {
  if (!developmentBaseNamePattern.test(name)) {
    throw new Error("Neon development base name is invalid");
  }
}

export function branchName(
  workspaceId: string,
  ownerNonce: string,
  kind: "primary" | "security",
) {
  if (
    !(
      workspaceIdPattern.test(workspaceId) && ownerNoncePattern.test(ownerNonce)
    )
  ) {
    throw new Error("Invalid Conductor workspace identity");
  }
  return `ws-${workspaceId.toLowerCase()}-${ownerNonce}-${kind}`;
}

export function newWorkspaceState(workspaceId: string): WorkspaceState {
  const ownerNonce = randomBytes(8).toString("hex");
  branchName(workspaceId, ownerNonce, "primary");
  return { version: 2, workspaceId, ownerNonce };
}

export function assertBranch(branch: NeonBranch, expected: BranchRecord) {
  if (
    branch.id !== expected.branchId ||
    branch.project_id !== expected.projectId ||
    branch.parent_id !== expected.parentId ||
    branch.name !== expected.name ||
    branch.primary ||
    branch.protected ||
    protectedBranchNamePattern.test(branch.name)
  ) {
    throw new Error(
      "Neon branch identity or ownership differs from workspace state",
    );
  }
}

export function assertWorkspaceRecord(
  record: BranchRecord,
  state: WorkspaceState,
  kind: "primary" | "security",
  boundary: ProjectBoundary,
) {
  assertRecordAgainstBases(record, state, kind, boundary, [
    boundary.baseBranchId,
  ]);
}

export function assertArchiveWorkspaceRecord(
  record: BranchRecord,
  state: WorkspaceState,
  kind: "primary" | "security",
  boundary: ProjectBoundary,
) {
  assertRecordAgainstBases(record, state, kind, boundary, [
    boundary.baseBranchId,
    ...(boundary.retainedBaseBranchIds ?? []),
  ]);
}

function assertRecordAgainstBases(
  record: BranchRecord,
  state: WorkspaceState,
  kind: "primary" | "security",
  boundary: ProjectBoundary,
  allowedBaseIds: string[],
) {
  if (
    record.projectId !== boundary.projectId ||
    !allowedBaseIds.includes(record.parentId) ||
    allowedBaseIds.includes(record.branchId) ||
    record.branchId === boundary.productionBranchId ||
    record.name !== branchName(state.workspaceId, state.ownerNonce, kind)
  ) {
    throw new Error(
      "Workspace Neon record does not match configured project boundary",
    );
  }
}

export function assertConnection(
  value: string | undefined,
  endpointId: string,
  pooled: boolean,
): asserts value is string {
  if (!value) {
    throw new Error("Workspace database connection is missing");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // biome-ignore lint/style/useErrorCause: URL parser errors may include credentials.
    throw new Error("Workspace database connection is invalid");
  }
  const expectedPrefix = `${endpointId}${pooled ? "-pooler" : ""}.`;
  if (
    !(
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.hostname.startsWith(expectedPrefix) &&
      url.hostname.endsWith(".neon.tech") &&
      url.username &&
      url.password &&
      url.pathname.slice(1)
    )
  ) {
    throw new Error("Workspace database URL does not match its Neon endpoint");
  }
}

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

function localWorkspaceIdentity(
  env: WorkspaceIdentityEnv,
  root: string,
): string | null {
  const path = env.CONDUCTOR_WORKSPACE_PATH;
  if (!path) {
    return null;
  }
  try {
    const workspacePath = realpathSync(path);
    const rootPath = env.CONDUCTOR_ROOT_PATH
      ? realpathSync(env.CONDUCTOR_ROOT_PATH)
      : null;
    if (
      workspacePath !== realpathSync(root) ||
      !(
        env.CONDUCTOR_PORT !== undefined ||
        env.CONDUCTOR_IS_LOCAL === "1" ||
        (rootPath && rootPath !== workspacePath)
      )
    ) {
      return null;
    }
    return `local-${createHash("sha256")
      .update(workspacePath)
      .digest("hex")
      .slice(0, 24)}`;
  } catch {
    return null;
  }
}

export function workspaceIdentity(
  env: WorkspaceIdentityEnv = process.env,
  root = repositoryRoot,
) {
  const id = env.CONDUCTOR_WORKSPACE_ID ?? localWorkspaceIdentity(env, root);
  if (!id) {
    throw new Error("Conductor workspace identity is required");
  }
  return id;
}

export function assertWorkspaceIdentity(
  id: string,
  env: WorkspaceIdentityEnv = process.env,
  root = repositoryRoot,
  boundLocalId?: string,
) {
  const localId = localWorkspaceIdentity(env, root);
  if (
    id !== env.CONDUCTOR_WORKSPACE_ID &&
    id !== localId &&
    !(localId && boundLocalId === localId)
  ) {
    throw new Error("Workspace Neon state identity mismatch");
  }
}

export function bindLocalWorkspaceIdentity<
  T extends { workspaceId: string; localWorkspaceId?: string },
>(state: T, env: WorkspaceIdentityEnv = process.env, root = repositoryRoot): T {
  assertWorkspaceIdentity(state.workspaceId, env, root, state.localWorkspaceId);
  const localId = localWorkspaceIdentity(env, root);
  if (localId) {
    state.localWorkspaceId = localId;
  }
  return state;
}

export const statePath = join(
  repositoryRoot,
  ".context",
  "neon-workspace.json",
);

export function readState(): WorkspaceState {
  if (!existsSync(statePath)) {
    throw new Error("Workspace Neon state is missing");
  }
  const state = JSON.parse(readFileSync(statePath, "utf8")) as WorkspaceState;
  if (
    state.version !== 2 ||
    !state.workspaceId ||
    !ownerNoncePattern.test(state.ownerNonce) ||
    (state.localWorkspaceId !== undefined &&
      !localWorkspaceIdPattern.test(state.localWorkspaceId))
  ) {
    throw new Error("Workspace Neon state identity mismatch");
  }
  assertWorkspaceIdentity(
    state.workspaceId,
    process.env,
    repositoryRoot,
    state.localWorkspaceId,
  );
  return state;
}

export function saveState(state: WorkspaceState) {
  bindLocalWorkspaceIdentity(state);
  mkdirSync(join(repositoryRoot, ".context"), {
    recursive: true,
    mode: 0o700,
  });
  const tempPath = `${statePath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(tempPath, 0o600);
  renameSync(tempPath, statePath);
}

export function neon(
  args: string[],
  executable = join(repositoryRoot, "node_modules", ".bin", "neonctl"),
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "ignore"],
      env: process.env,
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", () => reject(new Error("Neon command is unavailable")));
    child.on("close", (status) => {
      if (status === 0) {
        resolve(output.trim());
      } else {
        // CLI errors can contain connection strings. Never pass its raw output to logs.
        reject(
          new Error(
            `Neon command failed (${status}): ${args.slice(0, 2).join(" ")}`,
          ),
        );
      }
    });
  });
}

export async function listBranches(projectId: string): Promise<NeonBranch[]> {
  const result = JSON.parse(
    await neon([
      "branches",
      "list",
      "--project-id",
      projectId,
      "--output",
      "json",
    ]),
  ) as NeonBranch[] | { branches: NeonBranch[] };
  return Array.isArray(result) ? result : result.branches;
}

export async function getBranch(
  record: BranchRecord,
): Promise<NeonBranch | null> {
  return (
    (await listBranches(record.projectId)).find(
      (branch) => branch.id === record.branchId,
    ) ?? null
  );
}

export async function verifyRecord(record: BranchRecord) {
  const branch = await getBranch(record);
  if (!branch) {
    throw new Error("Workspace Neon branch is unavailable");
  }
  assertBranch(branch, record);
}

export async function connectionStrings(record: BranchRecord) {
  await verifyRecord(record);
  const common = [record.branchId, "--project-id", record.projectId];
  const [direct, pooled] = await Promise.all([
    neon(["connection-string", ...common]),
    neon(["connection-string", ...common, "--pooled"]),
  ]);
  assertConnection(direct, record.endpointId, false);
  assertConnection(pooled, record.endpointId, true);
  return { direct, pooled };
}

export async function verifyMigrationTarget(
  kind: "primary" | "security",
  pooledUrl: string | undefined,
  directUrl: string | undefined,
) {
  const state = readState();
  const record = state[kind];
  if (!record) {
    throw new Error("Workspace Neon branch is not provisioned");
  }
  const config = JSON.parse(
    readFileSync(join(repositoryRoot, ".conductor", "neon.json"), "utf8"),
  ) as Record<"primary" | "security", ProjectBoundary>;
  assertWorkspaceRecord(record, state, kind, config[kind]);
  await verifyRecord(record);
  assertConnection(pooledUrl, record.endpointId, true);
  assertConnection(directUrl, record.endpointId, false);
  const actual = await connectionStrings(record);
  for (const [given, fresh] of [
    [pooledUrl, actual.pooled],
    [directUrl, actual.direct],
  ]) {
    const left = new URL(given as string);
    const right = new URL(fresh);
    if (
      left.host !== right.host ||
      left.pathname !== right.pathname ||
      left.username !== right.username
    ) {
      throw new Error(
        "Workspace database URL differs from Neon branch metadata",
      );
    }
  }
}

export async function workspaceEnvironment(state: WorkspaceState) {
  if (!(state.primary && state.security && state.connections)) {
    throw new Error("Both workspace Neon branches are required");
  }
  await Promise.all([
    verifyMigrationTarget(
      "primary",
      state.connections.primary.pooled,
      state.connections.primary.direct,
    ),
    verifyMigrationTarget(
      "security",
      state.connections.security.pooled,
      state.connections.security.direct,
    ),
  ]);
  const port = workspacePort();
  return {
    ...process.env,
    DATABASE_URL: state.connections.primary.pooled,
    DATABASE_URL_UNPOOLED: state.connections.primary.direct,
    SECURITY_EVENT_DATABASE_URL: state.connections.security.pooled,
    SECURITY_EVENT_DATABASE_URL_UNPOOLED: state.connections.security.direct,
    PORT: String(port),
    BETTER_AUTH_URL: `http://localhost:${port}`,
    CORS_ORIGIN: `http://localhost:${port + 1}`,
    VITE_SERVER_URL: `http://localhost:${port}`,
    NEON_LOCAL: "false",
  };
}

export function workspacePort() {
  const port = Number(process.env.CONDUCTOR_PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65_525) {
    throw new Error("CONDUCTOR_PORT must reserve ten local ports");
  }
  return port;
}
