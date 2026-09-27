import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";

import { verifyDevelopmentBase } from "../packages/db/scripts/verify-development-base";
import { mergeWorkspaceEnv } from "./workspace-env";
import {
  assertArchiveWorkspaceRecord,
  assertBranch,
  assertDevelopmentBaseName,
  assertWorkspaceRecord,
  branchName,
  connectionStrings,
  getBranch,
  listBranches,
  neon,
  newWorkspaceState,
  readState,
  saveState,
  type WorkspaceState,
  workspaceEnvironment,
  workspacePort,
} from "./workspace-neon";

interface ProjectConfig {
  baseBranchId: string;
  productionBranchId: string;
  projectId: string;
  retainedBaseBranchIds?: string[];
}
interface Config {
  primary: ProjectConfig;
  security: ProjectConfig;
}
const config = JSON.parse(
  readFileSync(".conductor/neon.json", "utf8"),
) as Config;
const kinds = ["primary", "security"] as const;

function workspaceId() {
  const id = process.env.CONDUCTOR_WORKSPACE_ID;
  if (!id) {
    throw new Error("CONDUCTOR_WORKSPACE_ID is required");
  }
  return id;
}

function assertProjectConfiguration() {
  if (
    config.primary.projectId === config.security.projectId ||
    kinds.some((kind) => {
      const target = config[kind];
      const retained = target.retainedBaseBranchIds ?? [];
      return (
        !(target.projectId && target.baseBranchId) ||
        target.baseBranchId === target.productionBranchId ||
        retained.some(
          (id) =>
            !id ||
            id === target.baseBranchId ||
            id === target.productionBranchId,
        ) ||
        new Set(retained).size !== retained.length
      );
    })
  ) {
    throw new Error("Primary and security Neon project boundaries are invalid");
  }
}

async function provision(kind: "primary" | "security", state: WorkspaceState) {
  const target = config[kind];
  const name = branchName(state.workspaceId, state.ownerNonce, kind);
  const branches = await listBranches(target.projectId);
  const base = branches.find((branch) => branch.id === target.baseBranchId);
  if (!base || base.primary || base.protected) {
    throw new Error("Clean Neon development base is unavailable");
  }
  assertDevelopmentBaseName(base.name);
  await verifyDevelopmentBase(kind, target.projectId, target.baseBranchId);
  let record = state[kind];
  if (record) {
    const recorded = record;
    assertWorkspaceRecord(record, state, kind, target);
    const actual = branches.find((branch) => branch.id === recorded.branchId);
    if (!actual) {
      throw new Error(
        "Recorded workspace branch disappeared; refusing to replace it",
      );
    }
    assertBranch(actual, record);
  } else {
    let actual = branches.find((branch) => branch.name === name);
    if (!actual) {
      const created = JSON.parse(
        await neon([
          "branches",
          "create",
          "--project-id",
          target.projectId,
          "--name",
          name,
          "--parent",
          target.baseBranchId,
          "--output",
          "json",
        ]),
      ) as { branch?: { id: string } } & { id?: string };
      const id = created.branch?.id ?? created.id;
      if (!id) {
        throw new Error("Neon did not return a branch identity; rerun setup");
      }
      actual = (await listBranches(target.projectId)).find(
        (branch) => branch.id === id,
      );
    }
    if (!actual) {
      throw new Error("Created workspace branch is unavailable; rerun setup");
    }
    const direct = await neon([
      "connection-string",
      actual.id,
      "--project-id",
      target.projectId,
    ]);
    const [endpointId] = new URL(direct).hostname.split(".");
    record = {
      projectId: target.projectId,
      parentId: target.baseBranchId,
      branchId: actual.id,
      name,
      endpointId,
    };
    assertBranch(actual, record);
    state[kind] = record;
    saveState(state);
  }
  return connectionStrings(record);
}

function writeWorkspaceEnv(env: NodeJS.ProcessEnv) {
  const serverKeys = [
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "SECURITY_EVENT_DATABASE_URL",
    "SECURITY_EVENT_DATABASE_URL_UNPOOLED",
    "PORT",
    "BETTER_AUTH_URL",
    "CORS_ORIGIN",
    "NEON_LOCAL",
  ] as const;
  const serverPath = "apps/server/.env.local";
  const webPath = "apps/web/.env.local";
  const priorServer = existsSync(serverPath)
    ? readFileSync(serverPath, "utf8")
    : "";
  const priorWeb = existsSync(webPath) ? readFileSync(webPath, "utf8") : "";
  writeFileSync(
    serverPath,
    mergeWorkspaceEnv(
      priorServer,
      Object.fromEntries(serverKeys.map((key) => [key, env[key]])),
    ),
    {
      mode: 0o600,
    },
  );
  writeFileSync(
    webPath,
    mergeWorkspaceEnv(priorWeb, { VITE_SERVER_URL: env.VITE_SERVER_URL }),
    { mode: 0o600 },
  );
  chmodSync(serverPath, 0o600);
  chmodSync(webPath, 0o600);
}

async function setup() {
  assertProjectConfiguration();
  const hasLocalWorkspacePort = process.env.CONDUCTOR_PORT !== undefined;
  if (hasLocalWorkspacePort) {
    workspacePort();
  }
  try {
    execFileSync("git", ["fetch", "--quiet", "origin", "main"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    // biome-ignore lint/style/useErrorCause: Git errors can contain local credential details.
    throw new Error("Could not refresh origin/main before workspace setup");
  }
  const id = workspaceId();
  const state: WorkspaceState = readInitialState(id);
  const primary = await provision("primary", state);
  const security = await provision("security", state);
  state.connections = { primary, security };
  saveState(state);
  if (hasLocalWorkspacePort) {
    const env = await workspaceEnvironment(state);
    writeWorkspaceEnv(env);
  }
  console.log("Workspace Neon branches are ready in both projects");
}

function readInitialState(id: string): WorkspaceState {
  try {
    return readState();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Workspace Neon state is missing"
    ) {
      const state = newWorkspaceState(id);
      saveState(state);
      return state;
    }
    throw error;
  }
}

async function archive() {
  assertProjectConfiguration();
  const state = readState();
  for (const kind of kinds) {
    const record = state[kind];
    if (!record) {
      continue;
    }
    const target = config[kind];
    assertArchiveWorkspaceRecord(record, state, kind, target);
    // biome-ignore lint/performance/noAwaitInLoops: Archive must verify and persist each branch before deleting the next.
    const branch = await getBranch(record);
    if (branch) {
      assertBranch(branch, record);
      await neon([
        "branches",
        "delete",
        record.branchId,
        "--project-id",
        record.projectId,
      ]);
    }
    delete state[kind];
    saveState(state);
  }
  state.connections = undefined;
  saveState(state);
  console.log("Workspace Neon branches archived");
}

async function runMigration(
  kind: "primary" | "security",
  env: NodeJS.ProcessEnv,
) {
  const child = Bun.spawn(
    [
      "bun",
      "./scripts/migrate.ts",
      ...(kind === "security" ? ["--security-events"] : []),
    ],
    { cwd: "packages/db", env, stdout: "inherit", stderr: "inherit" },
  );
  if ((await child.exited) !== 0) {
    throw new Error(`${kind} migration failed; application was not started`);
  }
}

async function run() {
  assertProjectConfiguration();
  const env = await workspaceEnvironment(readState());
  await runMigration("primary", env);
  await runMigration("security", env);
  const api = Bun.spawn(["bun", "run", "--cwd", "apps/server", "dev"], {
    env,
    stdout: "inherit",
    stderr: "inherit",
  });
  let web: ReturnType<typeof Bun.spawn> | undefined;
  const stop = () => {
    web?.kill();
    api.kill();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  try {
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (api.exitCode !== null) {
        throw new Error("API exited before becoming ready");
      }
      try {
        // biome-ignore lint/performance/noAwaitInLoops: Readiness probes must run in order.
        const response = await fetch(
          `${env.BETTER_AUTH_URL}/api/auth/get-session`,
          {
            signal: AbortSignal.timeout(2000),
          },
        );
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* API is still starting. */
      }
      await Bun.sleep(500);
    }
    if (!ready) {
      throw new Error("API did not become ready; web was not started");
    }
    web = Bun.spawn(
      [
        "bun",
        "run",
        "--cwd",
        "apps/web",
        "dev",
        "--host",
        "localhost",
        "--port",
        String(Number(env.PORT) + 1),
      ],
      { env, stdout: "inherit", stderr: "inherit" },
    );
    const code = await web.exited;
    if (code !== 0) {
      throw new Error("Web process exited unsuccessfully");
    }
  } finally {
    stop();
  }
}

try {
  switch (process.argv[2]) {
    case "setup":
      await setup();
      break;
    case "run":
      await run();
      break;
    case "archive":
      await archive();
      break;
    default:
      throw new Error("Expected setup, run, or archive");
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Workspace operation failed",
  );
  process.exitCode = 1;
}
