import { existsSync } from "node:fs";
import { join } from "node:path";
import { checkMigrationSources } from "../packages/db/scripts/check-migrations";
import { acquireDevelopmentPromotionLease } from "../packages/db/scripts/development-promotion-lease";
import { verifyBaselineDatabase } from "../packages/db/scripts/workspace-baseline";
import { git, migrationBaseline } from "./migration-baseline";
import { NeonApi } from "./neon-api";
import {
  assertWorkspaceConnection,
  type DatabaseConfig,
  type DatabaseKind,
  databaseKinds,
  developmentBaseName,
  type Environment,
  forEachDatabase,
  newWorkspaceState,
  parseWorkspaceState,
  readDatabaseConfig,
  readWorkspaceState,
  type WorkspaceRecord,
  workspaceEnvironment,
  workspaceRoot,
  workspaceStatePath,
} from "./workspace-database";
import {
  archiveWorkspace,
  assertDevelopmentBase,
  assertDevelopmentBranch,
  bootstrapDevelopment,
  provisionWorkspace,
} from "./workspace-lifecycle";
import {
  readJson,
  withWorkspaceLock,
  writePrivateJson,
} from "./workspace-storage";

const whitespacePattern = /\s+/;

function managementClients(config: DatabaseConfig) {
  const primaryKey = process.env.NEON_API_KEY;
  const securityKey = process.env.NEON_SECURITY_API_KEY;
  if (!(primaryKey && securityKey)) {
    throw new Error(
      "NEON_API_KEY and NEON_SECURITY_API_KEY are required; use separate project-scoped keys",
    );
  }
  return {
    primary: new NeonApi(config.primary.projectId, primaryKey),
    security: new NeonApi(config.security.projectId, securityKey),
  };
}

function baselineState(workspaceId: string) {
  const commit = git(workspaceRoot, "merge-base", "origin/main", "HEAD");
  return newWorkspaceState(workspaceId, commit, {
    primary: migrationBaseline(workspaceRoot, commit, false).fingerprint,
    security: migrationBaseline(workspaceRoot, commit, true).fingerprint,
  });
}

async function verifyRecord(
  kind: DatabaseKind,
  record: WorkspaceRecord,
  commit: string,
) {
  if (!record.connection) {
    throw new Error("Database connection is missing");
  }
  await verifyBaselineDatabase(
    { DATABASE_URL: record.connection, CANTIARA_DEPLOY_MIGRATION: "true" },
    migrationBaseline(workspaceRoot, commit, kind === "security").files,
    { deployment: true },
  );
}

async function setup() {
  const workspaceId = process.env.CONDUCTOR_WORKSPACE_ID;
  if (!workspaceId) {
    throw new Error("CONDUCTOR_WORKSPACE_ID is required");
  }
  if (process.env.NEON_LOCAL === "true") {
    console.log(
      "Disposable local database mode; no Neon resources provisioned",
    );
    return;
  }
  const config = readDatabaseConfig();
  if (databaseKinds.some((kind) => !config[kind].developmentBranchId)) {
    throw new Error(
      "Canonical development databases are not initialized; run db:development:bootstrap with management keys first",
    );
  }
  const clients = managementClients(config);
  const state = readWorkspaceState() ?? baselineState(workspaceId);
  if (state.workspaceId !== workspaceId) {
    throw new Error(
      "Copied database state belongs to a different Conductor workspace",
    );
  }
  const save = async () => writePrivateJson(workspaceStatePath(), state);
  await save();
  await provisionWorkspace({
    config,
    clients,
    state,
    save,
    verify: (kind, record) => verifyRecord(kind, record, state.baselineCommit),
  });
  workspaceEnvironment(process.env, state, config);
  console.log(
    "Two isolated workspace databases verified. Setup applied no migrations. Use db:migrate and db:security:migrate explicitly for your changes.",
  );
}

async function run(
  command: string[],
  environment: Environment,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const child = Bun.spawn(command, {
    cwd: workspaceRoot,
    env: environment,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const stop = () => child.kill();
  signal.addEventListener("abort", stop, { once: true });
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    if ((await child.exited) !== 0 || signal.aborted) {
      throw new Error(
        "Canonical database command failed or lost its promotion lease; no readiness was published",
      );
    }
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    signal.removeEventListener("abort", stop);
  }
}

function canonicalEnvironment(
  connections: Record<DatabaseKind, string>,
): Environment {
  return {
    ...process.env,
    CONDUCTOR_WORKSPACE_ID: undefined,
    NEON_API_KEY: undefined,
    NEON_SECURITY_API_KEY: undefined,
    DATABASE_URL: connections.primary,
    DATABASE_URL_UNPOOLED: connections.primary,
    SECURITY_EVENT_DATABASE_URL: connections.security,
    SECURITY_EVENT_DATABASE_URL_UNPOOLED: connections.security,
    NEON_LOCAL: "false",
    SECURITY_EVENT_LOCAL: "false",
    CANTIARA_DEPLOY_MIGRATION: "true",
  };
}

async function canonicalConnections(
  config: DatabaseConfig,
  clients: ReturnType<typeof managementClients>,
) {
  if (databaseKinds.some((kind) => !config[kind].developmentBranchId)) {
    throw new Error(
      "Canonical development databases are not initialized; run db:development:bootstrap first",
    );
  }
  const connections = {} as Record<DatabaseKind, string>;
  await forEachDatabase(async (kind) => {
    const boundary = config[kind];
    const branch = assertDevelopmentBranch(
      await clients[kind].getBranch(boundary.developmentBranchId ?? ""),
      boundary,
    );
    const endpoint = await clients[kind].endpoint(branch.id);
    const connection = await clients[kind].connection(
      branch.id,
      endpoint.id,
      boundary.databaseName,
      boundary.roleName,
    );
    assertWorkspaceConnection(
      connection,
      {
        projectId: boundary.projectId,
        branchId: branch.id,
        parentId: boundary.productionBranchId,
        name: branch.name,
        endpointId: endpoint.id,
        verified: false,
      },
      boundary,
    );
    connections[kind] = connection;
  });
  return connections;
}

async function publishBases(
  config: DatabaseConfig,
  clients: ReturnType<typeof managementClients>,
  commit: string,
) {
  await forEachDatabase(async (kind) => {
    const boundary = config[kind];
    const baseline = migrationBaseline(
      workspaceRoot,
      commit,
      kind === "security",
    );
    const name = developmentBaseName(baseline.fingerprint);
    const branch = assertDevelopmentBase(
      (await clients[kind].findBranch(name)) ??
        (await clients[kind].createBranch(
          name,
          boundary.developmentBranchId ?? "",
        )),
      boundary,
      baseline.fingerprint,
    );
    const endpoint = await clients[kind].endpoint(branch.id);
    const connection = await clients[kind].connection(
      branch.id,
      endpoint.id,
      boundary.databaseName,
      boundary.roleName,
    );
    assertWorkspaceConnection(
      connection,
      {
        branchId: branch.id,
        projectId: boundary.projectId,
        parentId: boundary.developmentBranchId ?? "",
        endpointId: endpoint.id,
        name: branch.name,
        verified: false,
      },
      boundary,
    );
    await verifyBaselineDatabase(
      { DATABASE_URL: connection, CANTIARA_DEPLOY_MIGRATION: "true" },
      baseline.files,
      { deployment: true },
    );
  });
}

async function migrateCanonical(
  config: DatabaseConfig,
  clients: ReturnType<typeof managementClients>,
  commit: string,
) {
  await checkMigrationSources();
  await checkMigrationSources(true);
  const environment = canonicalEnvironment(
    await canonicalConnections(config, clients),
  );
  const lease = await acquireDevelopmentPromotionLease(environment, {
    deployment: true,
  });
  try {
    await lease.verify();
    await run(
      ["bun", "packages/db/scripts/migrate.ts", "--deployment"],
      environment,
      lease.signal,
    );
    await lease.verify();
    await run(
      [
        "bun",
        "packages/db/scripts/migrate.ts",
        "--security-events",
        "--deployment",
      ],
      environment,
      lease.signal,
    );
    await forEachDatabase(async (kind) => {
      await verifyBaselineDatabase(
        {
          DATABASE_URL:
            kind === "primary"
              ? environment.DATABASE_URL
              : environment.SECURITY_EVENT_DATABASE_URL,
          CANTIARA_DEPLOY_MIGRATION: "true",
        },
        migrationBaseline(workspaceRoot, commit, kind === "security").files,
        { deployment: true },
      );
    });
    await lease.verify();
    await publishBases(config, clients, commit);
    await lease.verify();
  } finally {
    await lease.close();
  }
}

async function bootstrap() {
  const config = readDatabaseConfig();
  if (databaseKinds.some((kind) => config[kind].developmentBranchId)) {
    throw new Error(
      "Development targets already configured; use db:development:promote, not bootstrap",
    );
  }
  const clients = managementClients(config);
  const stateFile = join(
    workspaceRoot,
    ".context/neon-development-bootstrap.json",
  );
  const state = existsSync(stateFile)
    ? parseWorkspaceState(readJson(stateFile))
    : baselineState("bootstrap");
  for (const kind of databaseKinds) {
    if (
      migrationBaseline(workspaceRoot, undefined, kind === "security")
        .fingerprint !== state.baselineFingerprints[kind]
    ) {
      throw new Error(
        "Bootstrap requires canonical origin/main migrations; do not include feature migrations",
      );
    }
  }
  writePrivateJson(stateFile, state);
  await bootstrapDevelopment({
    state,
    config,
    clients,
    save: () => {
      writePrivateJson(stateFile, state);
      return Promise.resolve();
    },
    migrate: () => migrateCanonical(config, clients, state.baselineCommit),
    saveConfiguration: () => {
      writePrivateJson(join(workspaceRoot, ".conductor/neon.json"), config);
      return Promise.resolve();
    },
  });
  console.log(
    "Fresh canonical development targets configured. Commit the non-secret .conductor/neon.json IDs when reviewing this rollout.",
  );
}

async function promote() {
  const commit = git(workspaceRoot, "rev-parse", "HEAD");
  if (
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.PROMOTION_COMMIT !== commit
  ) {
    throw new Error(
      "Canonical promotion requires the successful main CI workflow and its exact commit",
    );
  }
  const [latest] = git(
    workspaceRoot,
    "ls-remote",
    "origin",
    "refs/heads/main",
  ).split(whitespacePattern);
  if (latest !== commit) {
    console.log(
      "Superseded main run; waiting for validation of the current main commit",
    );
    return;
  }
  if (git(workspaceRoot, "status", "--porcelain")) {
    throw new Error("Canonical checkout must be clean");
  }
  const config = readDatabaseConfig();
  await migrateCanonical(config, managementClients(config), commit);
  const [currentMain] = git(
    workspaceRoot,
    "ls-remote",
    "origin",
    "refs/heads/main",
  ).split(whitespacePattern);
  if (currentMain !== commit) {
    throw new Error(
      "Main advanced during promotion; retained bases remain valid, but latest main readiness has not been published",
    );
  }
  console.log(
    "Canonical development databases and retained Git migration bases verified for current main. No workspace data was promoted.",
  );
}

async function archive(discard: boolean) {
  const state = readWorkspaceState();
  if (!state || state.archived) {
    console.log("No active workspace databases to archive");
    return;
  }
  if (state.workspaceId !== process.env.CONDUCTOR_WORKSPACE_ID) {
    throw new Error("Workspace ownership mismatch");
  }
  const config = readDatabaseConfig();
  const clients = managementClients(config);
  if (!discard) {
    if (git(workspaceRoot, "status", "--porcelain")) {
      throw new Error(
        "Uncommitted changes remain; use --discard only for intentional abandonment",
      );
    }
    git(workspaceRoot, "fetch", "origin", "main");
    const result = Bun.spawnSync(
      ["gh", "pr", "view", "--json", "state,headRefOid,baseRefName"],
      { cwd: workspaceRoot },
    );
    if (!result.success) {
      throw new Error(
        "Cannot verify the merged PR; retain databases or explicitly use --discard",
      );
    }
    const pr = JSON.parse(result.stdout.toString());
    if (
      pr.state !== "MERGED" ||
      pr.baseRefName !== "main" ||
      pr.headRefOid !== git(workspaceRoot, "rev-parse", "HEAD")
    ) {
      throw new Error(
        "The current workspace PR has not been merged; databases retained",
      );
    }
    const commit = git(workspaceRoot, "rev-parse", "origin/main");
    const connections = await canonicalConnections(config, clients);
    await forEachDatabase(async (kind) => {
      await verifyBaselineDatabase(
        { DATABASE_URL: connections[kind], CANTIARA_DEPLOY_MIGRATION: "true" },
        migrationBaseline(workspaceRoot, commit, kind === "security").files,
        { deployment: true },
      );
    });
  }
  await archiveWorkspace({
    config,
    clients,
    state,
    save: async () => writePrivateJson(workspaceStatePath(), state),
  });
  console.log(
    "Owned workspace databases archived; canonical and production databases retained",
  );
}

if (import.meta.main) {
  try {
    const argumentsList = process.argv.slice(2);
    const [action, option] = argumentsList;
    if (argumentsList.length > 2) {
      throw new Error("Unexpected workspace database arguments");
    }
    if (action === "--help") {
      console.log(
        "setup | archive [--discard] | bootstrap | promote. Run never provisions or migrates. See docs/agents/workspace-databases.md.",
      );
    } else {
      if (option && !(action === "archive" && option === "--discard")) {
        throw new Error("Unknown workspace database option");
      }
      await withWorkspaceLock(
        join(workspaceRoot, ".context/neon-workspace.lock"),
        async () => {
          if (action === "setup") {
            await setup();
          } else if (action === "archive") {
            await archive(option === "--discard");
          } else if (action === "bootstrap") {
            await bootstrap();
          } else if (action === "promote") {
            await promote();
          } else {
            throw new Error("Unknown workspace database command; use --help");
          }
        },
      );
    }
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Workspace database operation failed",
    );
    process.exitCode = 1;
  }
}
