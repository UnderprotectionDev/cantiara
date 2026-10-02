import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applicationEnvironment,
  type DatabaseConfig,
  newWorkspaceState,
  parseDatabaseConfig,
  resolveWorkspaceIdentity,
  workspaceBranchName,
  workspaceEnvironment,
  workspaceRoot,
} from "./workspace-database";

let fixtureRoot: string;
let repository: string;
let worktree: string;
let inactiveWorkspace: string;
let setupScript: string;
const workspaceLocationPattern = /^path-[a-f0-9]{40}$/;

beforeAll(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), "cantiara-workspace-"));
  repository = join(fixtureRoot, "repository");
  worktree = join(fixtureRoot, "worktree");
  execFileSync("git", ["init", repository]);
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.test",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "-m",
      "fixture",
    ],
    { cwd: repository },
  );
  execFileSync("git", ["worktree", "add", "--detach", worktree], {
    cwd: repository,
  });
  setupScript = execFileSync(
    "bun",
    [
      "--eval",
      'console.log(Bun.TOML.parse(await Bun.file(".conductor/settings.toml").text()).scripts.setup)',
    ],
    { cwd: workspaceRoot, encoding: "utf8" },
  ).trim();
  inactiveWorkspace = join(fixtureRoot, "inactive-workspace");
  cpSync(join(workspaceRoot, "scripts"), join(inactiveWorkspace, "scripts"), {
    recursive: true,
  });
  for (const directory of ["node_modules", "packages"]) {
    symlinkSync(
      join(workspaceRoot, directory),
      join(inactiveWorkspace, directory),
      "dir",
    );
  }
  mkdirSync(join(inactiveWorkspace, ".conductor"));
  cpSync(
    join(workspaceRoot, ".conductor/neon.json"),
    join(inactiveWorkspace, ".conductor/neon.json"),
  );
});

afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }));

const config: DatabaseConfig = {
  version: 1,
  primary: {
    projectId: "project-primary",
    productionBranchId: "br-prod-primary",
    developmentBranchId: "br-dev-primary",
    databaseName: "development",
    roleName: "primary_owner",
  },
  security: {
    projectId: "project-security",
    productionBranchId: "br-prod-security",
    developmentBranchId: "br-dev-security",
    databaseName: "development",
    roleName: "security_owner",
  },
};
function ownedState() {
  const state = newWorkspaceState("workspace-one", "c".repeat(40), {
    primary: "a".repeat(64),
    security: "b".repeat(64),
  });
  for (const kind of ["primary", "security"] as const) {
    state[kind] = {
      projectId: config[kind].projectId,
      branchId: `br-child-${kind}`,
      parentId: `br-base-${kind}`,
      endpointId: `ep-child-${kind}`,
      name: workspaceBranchName(state, kind),
      verified: true,
      connection: `postgresql://${config[kind].roleName}:password@ep-child-${kind}.eu.neon.tech/development`,
    };
  }
  return state;
}

describe("on-demand workspace database activation", () => {
  it.each([
    { local: "1", hasIssue: false, hasDatabases: false },
    { local: "1", hasIssue: true, hasDatabases: false },
    { local: "0", hasIssue: false, hasDatabases: false },
    { local: "0", hasIssue: true, hasDatabases: false },
    { local: "1", hasIssue: true, hasDatabases: true },
    { local: "0", hasIssue: false, hasDatabases: true },
  ])(
    "installs dependencies without activating databases (local=$local, issue=$hasIssue, databases=$hasDatabases)",
    ({ local, hasIssue, hasDatabases }) => {
      const setupWorkspace = mkdtempSync(join(fixtureRoot, "setup-"));
      const bin = join(setupWorkspace, "bin");
      const commands = join(setupWorkspace, "commands.log");
      mkdirSync(bin);
      writeFileSync(
        join(bin, "bun"),
        '#!/bin/sh\nprintf "%s\\n" "$*" >> "$COMMAND_LOG"\n',
        { mode: 0o755 },
      );
      if (hasIssue) {
        const attachments = join(setupWorkspace, ".context/attachments");
        mkdirSync(attachments, { recursive: true });
        writeFileSync(
          join(attachments, "[GITHUB]-123.md"),
          "# Fixture issue\n",
        );
      }
      const stateFile = join(setupWorkspace, ".context/neon-workspace.json");
      const receipt = JSON.stringify(ownedState());
      if (hasDatabases) {
        mkdirSync(join(setupWorkspace, ".context"), { recursive: true });
        writeFileSync(stateFile, receipt, { mode: 0o600 });
      }
      const result = spawnSync("/bin/sh", ["-c", setupScript], {
        cwd: setupWorkspace,
        encoding: "utf8",
        env: {
          PATH: bin,
          COMMAND_LOG: commands,
          CONDUCTOR_IS_LOCAL: local,
        },
        timeout: 10_000,
      });
      expect(result.status).toBe(0);
      expect(readFileSync(commands, "utf8")).toBe("install\n");
      expect(existsSync(stateFile)).toBe(hasDatabases);
      if (hasDatabases) {
        expect(readFileSync(stateFile, "utf8")).toBe(receipt);
      }
    },
  );

  it("archives a database-free workspace without identity or management credentials", () => {
    const result = spawnSync(
      "bun",
      ["scripts/conductor-workspace.ts", "archive"],
      {
        cwd: inactiveWorkspace,
        encoding: "utf8",
        env: {
          ...process.env,
          CONDUCTOR_WORKSPACE_ID: undefined,
          CONDUCTOR_ROOT_PATH: undefined,
          CONDUCTOR_WORKSPACE_PATH: undefined,
          NEON_API_KEY: undefined,
          NEON_SECURITY_API_KEY: undefined,
          NEON_LOCAL: "false",
        },
        timeout: 10_000,
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No active workspace databases to archive");
    expect(
      existsSync(join(inactiveWorkspace, ".context/neon-workspace.json")),
    ).toBe(false);
  });

  it("directs database-backed Run to explicit setup instead of using inherited URLs", () => {
    const result = spawnSync("bun", ["scripts/local-dev.ts", "server"], {
      cwd: inactiveWorkspace,
      encoding: "utf8",
      env: {
        ...process.env,
        CONDUCTOR_WORKSPACE_ID: undefined,
        CONDUCTOR_ROOT_PATH: undefined,
        CONDUCTOR_WORKSPACE_PATH: undefined,
        NEON_API_KEY: undefined,
        NEON_SECURITY_API_KEY: undefined,
        NEON_LOCAL: "false",
        DATABASE_URL: "shared-primary-private-secret",
        SECURITY_EVENT_DATABASE_URL: "shared-security-private-secret",
      },
      timeout: 10_000,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("bun run db:workspace:setup");
    expect(result.stderr).not.toContain("private-secret");
    expect(
      existsSync(join(inactiveWorkspace, ".context/neon-workspace.json")),
    ).toBe(false);
  });
});

describe("workspace database environment", () => {
  it("preserves owned database targets and worktree identity through Turbo strict mode", () => {
    const taskWorkspace = join(fixtureRoot, "turbo-workspace");
    execFileSync("git", ["worktree", "add", "--detach", taskWorkspace], {
      cwd: repository,
    });
    for (const path of [
      ".context",
      ".conductor",
      "apps/server",
      "scripts",
      "packages/db/scripts",
      "packages/db/src",
    ]) {
      mkdirSync(join(taskWorkspace, path), { recursive: true });
    }
    for (const path of [
      "turbo.json",
      "scripts/workspace-database.ts",
      "scripts/workspace-storage.ts",
      "scripts/migration-baseline.ts",
      "packages/db/scripts/migration-target.ts",
      "packages/db/scripts/migration-connection.ts",
      "packages/db/src/security-event-database-url.ts",
    ]) {
      cpSync(join(workspaceRoot, path), join(taskWorkspace, path));
    }
    for (const path of ["node_modules", "packages/db/node_modules"]) {
      symlinkSync(join(workspaceRoot, path), join(taskWorkspace, path), "dir");
    }
    const { packageManager } = JSON.parse(
      readFileSync(join(workspaceRoot, "package.json"), "utf8"),
    );
    writeFileSync(
      join(taskWorkspace, "package.json"),
      JSON.stringify({
        name: "turbo-fixture",
        private: true,
        packageManager,
        workspaces: ["apps/*"],
      }),
    );
    writeFileSync(
      join(taskWorkspace, "bun.lock"),
      JSON.stringify({
        lockfileVersion: 1,
        configVersion: 1,
        workspaces: {
          "": { name: "turbo-fixture" },
          "apps/server": { name: "server" },
        },
        packages: {},
      }),
    );
    writeFileSync(
      join(taskWorkspace, "apps/server/package.json"),
      JSON.stringify({
        name: "server",
        scripts: { dev: "bun --env-file=.env.local probe.ts" },
      }),
    );
    writeFileSync(
      join(taskWorkspace, "apps/server/.env.local"),
      [
        "DATABASE_URL_UNPOOLED=postgresql://primary_owner:private-secret@ep-stale-primary.eu.neon.tech/development",
        "SECURITY_EVENT_DATABASE_URL_UNPOOLED=postgresql://security_owner:private-secret@ep-stale-security.eu.neon.tech/development",
      ].join("\n"),
    );
    writeFileSync(
      join(taskWorkspace, "apps/server/probe.ts"),
      `import { loadWorkspaceEnvironment } from "../../scripts/workspace-database";
import { resolveMigrationTarget } from "../../packages/db/scripts/migration-target";
const observed = {
  workspaceId: process.env.CONDUCTOR_WORKSPACE_ID,
  rootPath: process.env.CONDUCTOR_ROOT_PATH,
  workspacePath: process.env.CONDUCTOR_WORKSPACE_PATH,
  primaryDirect: process.env.DATABASE_URL_UNPOOLED === process.env.DATABASE_URL,
  securityDirect: process.env.SECURITY_EVENT_DATABASE_URL_UNPOOLED === process.env.SECURITY_EVENT_DATABASE_URL,
  managementKeysAbsent: !process.env.NEON_API_KEY && !process.env.NEON_SECURITY_API_KEY,
  ownershipAccepted: false,
  primaryAccepted: false,
  securityAccepted: false,
};
try {
  const environment = loadWorkspaceEnvironment(process.env);
  observed.ownershipAccepted = environment.CONDUCTOR_WORKSPACE_ID === observed.workspaceId;
  observed.primaryAccepted = resolveMigrationTarget(process.env).databaseUrl === environment.DATABASE_URL;
  observed.securityAccepted = resolveMigrationTarget(process.env, { securityEvents: true }).databaseUrl === environment.SECURITY_EVENT_DATABASE_URL;
} catch {}
await Bun.write(new URL("../../.context/turbo-environment.json", import.meta.url), JSON.stringify(observed));
`,
    );
    const paths = {
      CONDUCTOR_ROOT_PATH: repository,
      CONDUCTOR_WORKSPACE_PATH: taskWorkspace,
    };
    const identity = resolveWorkspaceIdentity(paths, undefined, taskWorkspace);
    const state = ownedState();
    state.workspaceId = identity.workspaceId;
    state.workspaceLocation = identity.workspaceLocation;
    for (const kind of ["primary", "security"] as const) {
      const record = state[kind];
      if (record) {
        record.name = workspaceBranchName(state, kind);
      }
    }
    writeFileSync(
      join(taskWorkspace, ".context/neon-workspace.json"),
      JSON.stringify(state),
      { mode: 0o600 },
    );
    writeFileSync(
      join(taskWorkspace, ".conductor/neon.json"),
      JSON.stringify(config),
    );
    const environment = workspaceEnvironment(
      paths,
      state,
      config,
      taskWorkspace,
    );
    const result = spawnSync(
      join(workspaceRoot, "node_modules/.bin/turbo"),
      ["run", "dev", "--filter=server", "--env-mode=strict", "--ui=stream"],
      {
        cwd: taskWorkspace,
        env: {
          ...environment,
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          TURBO_TELEMETRY_DISABLED: "1",
          DO_NOT_TRACK: "1",
          NEON_API_KEY: "management-private-secret",
          NEON_SECURITY_API_KEY: "security-management-private-secret",
        },
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout + result.stderr).not.toContain("private-secret");
    expect(
      JSON.parse(
        readFileSync(
          join(taskWorkspace, ".context/turbo-environment.json"),
          "utf8",
        ),
      ),
    ).toEqual({
      workspaceId: identity.workspaceId,
      rootPath: repository,
      workspacePath: taskWorkspace,
      primaryDirect: true,
      securityDirect: true,
      managementKeysAbsent: true,
      ownershipAccepted: true,
      primaryAccepted: true,
      securityAccepted: true,
    });
  });

  it("uses one owned identity in Setup and agent sessions without requiring a native workspace ID", () => {
    const environment = {
      CONDUCTOR_ROOT_PATH: repository,
      CONDUCTOR_WORKSPACE_PATH: worktree,
    };
    const identity = resolveWorkspaceIdentity(environment, undefined, worktree);
    const state = ownedState();
    state.workspaceId = identity.workspaceId;
    for (const kind of ["primary", "security"] as const) {
      const record = state[kind];
      if (record) {
        record.name = workspaceBranchName(state, kind);
      }
    }
    const setup = workspaceEnvironment(environment, state, config, worktree);
    const agent = workspaceEnvironment(
      { ...environment, CONDUCTOR_WORKSPACE_ID: "agent-native-id" },
      state,
      config,
      worktree,
    );
    expect(identity.workspaceId).toMatch(workspaceLocationPattern);
    expect(setup.CONDUCTOR_WORKSPACE_ID).toBe(identity.workspaceId);
    expect(agent.CONDUCTOR_WORKSPACE_ID).toBe(identity.workspaceId);
    expect(setup.DATABASE_URL).toBe(state.primary?.connection);
    expect(agent.DATABASE_URL).toBe(setup.DATABASE_URL);
  });

  it("binds verified legacy ownership without renaming its existing Neon branches", () => {
    const state = ownedState();
    const environment = {
      CONDUCTOR_ROOT_PATH: repository,
      CONDUCTOR_WORKSPACE_PATH: worktree,
    };
    const originalName = state.primary?.name;
    expect(() =>
      resolveWorkspaceIdentity(environment, state, worktree),
    ).toThrow("legacy state");
    const identity = resolveWorkspaceIdentity(
      { ...environment, CONDUCTOR_WORKSPACE_ID: state.workspaceId },
      state,
      worktree,
    );
    state.workspaceLocation = identity.workspaceLocation;
    const result = workspaceEnvironment(environment, state, config, worktree);
    expect(result.DATABASE_URL).toBe(state.primary?.connection);
    expect(state.workspaceId).toBe("workspace-one");
    expect(state.primary?.name).toBe(originalName);
  });

  it("rejects copied path-bound state even when the native ID matches", () => {
    const environment = {
      CONDUCTOR_ROOT_PATH: repository,
      CONDUCTOR_WORKSPACE_PATH: worktree,
      CONDUCTOR_WORKSPACE_ID: "workspace-one",
    };
    const state = ownedState();
    state.workspaceLocation = `path-${"0".repeat(40)}`;
    expect(() =>
      workspaceEnvironment(environment, state, config, worktree),
    ).toThrow("different Conductor workspace");
    expect(() =>
      resolveWorkspaceIdentity(
        { CONDUCTOR_WORKSPACE_ID: state.workspaceId },
        state,
        worktree,
      ),
    ).toThrow("Conductor workspace paths are required");
  });

  it("rejects missing, foreign and non-worktree paths instead of using a native ID as a fallback", () => {
    const otherRepository = join(fixtureRoot, "other-repository");
    execFileSync("git", ["init", otherRepository]);
    for (const paths of [
      { CONDUCTOR_ROOT_PATH: repository },
      { CONDUCTOR_WORKSPACE_PATH: worktree },
      { CONDUCTOR_ROOT_PATH: repository, CONDUCTOR_WORKSPACE_PATH: repository },
      {
        CONDUCTOR_ROOT_PATH: otherRepository,
        CONDUCTOR_WORKSPACE_PATH: worktree,
      },
      {
        CONDUCTOR_ROOT_PATH: repository,
        CONDUCTOR_WORKSPACE_PATH: "relative-worktree",
      },
      {
        CONDUCTOR_ROOT_PATH: repository,
        CONDUCTOR_WORKSPACE_PATH: join(fixtureRoot, "missing"),
      },
    ]) {
      expect(() =>
        resolveWorkspaceIdentity(
          { ...paths, CONDUCTOR_WORKSPACE_ID: "workspace-one" },
          undefined,
          worktree,
        ),
      ).toThrow();
    }
    expect(() =>
      resolveWorkspaceIdentity(
        { CONDUCTOR_ROOT_PATH: repository, CONDUCTOR_WORKSPACE_PATH: worktree },
        undefined,
        repository,
      ),
    ).toThrow("Invalid Conductor workspace paths");
  });

  it("canonicalizes symlinks and isolates different worktrees regardless of display names", () => {
    const alias = join(fixtureRoot, "worktree-alias");
    symlinkSync(worktree, alias);
    const environment = {
      CONDUCTOR_ROOT_PATH: repository,
      CONDUCTOR_WORKSPACE_PATH: worktree,
    };
    const identity = resolveWorkspaceIdentity(environment, undefined, worktree);
    expect(
      resolveWorkspaceIdentity(
        {
          ...environment,
          CONDUCTOR_WORKSPACE_PATH: alias,
          CONDUCTOR_WORKSPACE_NAME: "renamed",
        },
        undefined,
        alias,
      ),
    ).toEqual(identity);
    const otherWorktree = join(fixtureRoot, "other-worktree");
    execFileSync("git", ["worktree", "add", "--detach", otherWorktree], {
      cwd: repository,
    });
    expect(
      resolveWorkspaceIdentity(
        { ...environment, CONDUCTOR_WORKSPACE_PATH: otherWorktree },
        undefined,
        otherWorktree,
      ).workspaceId,
    ).not.toBe(identity.workspaceId);
  });

  it("refuses a standalone terminal with inherited remote URLs but no Conductor identity", () => {
    expect(() =>
      resolveWorkspaceIdentity({ DATABASE_URL: "shared" }, undefined, worktree),
    ).toThrow("workspace identity is required");
    expect(() =>
      resolveWorkspaceIdentity(
        { CONDUCTOR_WORKSPACE_ID: "invalid/id" },
        undefined,
        worktree,
      ),
    ).toThrow("workspace identity is required");
  });

  it("rejects old ownership when a workspace path is reused for a new Git worktree", () => {
    const recreated = join(fixtureRoot, "recreated-worktree");
    const environment = {
      CONDUCTOR_ROOT_PATH: repository,
      CONDUCTOR_WORKSPACE_PATH: recreated,
    };
    execFileSync("git", ["worktree", "add", "--detach", recreated], {
      cwd: repository,
    });
    const original = resolveWorkspaceIdentity(
      environment,
      undefined,
      recreated,
    );
    const state = ownedState();
    state.workspaceLocation = original.workspaceLocation;
    execFileSync("git", ["worktree", "remove", recreated], { cwd: repository });
    execFileSync("git", ["worktree", "add", "--detach", recreated], {
      cwd: repository,
    });
    expect(() =>
      resolveWorkspaceIdentity(environment, state, recreated),
    ).toThrow("different Conductor workspace");
  });

  it("runs the actual Setup CLI in disposable local mode without any Conductor ID or Neon credentials", () => {
    const result = spawnSync(
      "bun",
      ["scripts/conductor-workspace.ts", "setup"],
      {
        cwd: workspaceRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          CONDUCTOR_WORKSPACE_ID: undefined,
          CONDUCTOR_ROOT_PATH: undefined,
          CONDUCTOR_WORKSPACE_PATH: undefined,
          NEON_API_KEY: undefined,
          NEON_SECURITY_API_KEY: undefined,
          NEON_LOCAL: "true",
        },
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("no Neon resources provisioned");
    expect(result.stderr).not.toContain("CONDUCTOR_WORKSPACE_ID is required");
  });

  it("refuses a Conductor workspace without its own databases", () => {
    expect(() =>
      workspaceEnvironment(
        { CONDUCTOR_WORKSPACE_ID: "workspace-one", DATABASE_URL: "shared" },
        undefined,
      ),
    ).toThrow("db:workspace:setup");
  });

  it("keeps disposable local fixtures outside the Neon lifecycle", () => {
    const environment = {
      CONDUCTOR_WORKSPACE_ID: "workspace-one",
      NEON_LOCAL: "true",
      DATABASE_URL: "postgresql://localhost/fixture",
    };
    expect(workspaceEnvironment(environment, undefined)).toEqual(environment);
  });

  it("removes management credentials from local and non-Conductor child environments", () => {
    for (const mode of [{ NEON_LOCAL: "true" }, {}]) {
      const result = applicationEnvironment({
        ...mode,
        NEON_API_KEY: "management",
        NEON_SECURITY_API_KEY: "security",
      });
      expect(result.NEON_API_KEY).toBeUndefined();
      expect(result.NEON_SECURITY_API_KEY).toBeUndefined();
    }
  });

  it("never falls back to inherited remote URLs when workspace identity is absent", () => {
    expect(() =>
      workspaceEnvironment(
        {
          DATABASE_URL:
            "postgresql://owner:secret@ep-shared.neon.tech/development",
        },
        undefined,
      ),
    ).toThrow("db:workspace:setup");
  });

  it("uses the same owned direct targets for the app and migrations instead of copied URLs", () => {
    const result = workspaceEnvironment(
      {
        CONDUCTOR_WORKSPACE_ID: "workspace-one",
        DATABASE_URL: "shared-primary",
        DATABASE_URL_UNPOOLED: "shared-unpooled",
        SECURITY_EVENT_DATABASE_URL: "shared-security",
        NEON_API_KEY: "private-key",
        NEON_SECURITY_API_KEY: "private-security-key",
        BETTER_AUTH_SECRET: "application-secret",
        SECURITY_EVENT_LOCAL: "true",
      },
      ownedState(),
      config,
    );
    expect(result.DATABASE_URL).toBe(
      "postgresql://primary_owner:password@ep-child-primary.eu.neon.tech/development",
    );
    expect(result.DATABASE_URL_UNPOOLED).toBe(result.DATABASE_URL);
    expect(result.SECURITY_EVENT_DATABASE_URL_UNPOOLED).toBe(
      result.SECURITY_EVENT_DATABASE_URL,
    );
    expect(result.BETTER_AUTH_SECRET).toBe("application-secret");
    expect(result.NEON_API_KEY).toBeUndefined();
    expect(result.NEON_SECURITY_API_KEY).toBeUndefined();
    expect(result.SECURITY_EVENT_LOCAL).toBe("false");
  });

  it("refuses copied, archived, incomplete and production-owned state", () => {
    for (const change of [
      (state: ReturnType<typeof ownedState>) => {
        state.workspaceId = "another-workspace";
      },
      (state: ReturnType<typeof ownedState>) => {
        state.archived = true;
      },
      (state: ReturnType<typeof ownedState>) => {
        if (state.primary) {
          state.primary.verified = false;
        }
      },
      (state: ReturnType<typeof ownedState>) => {
        if (state.primary) {
          state.primary.branchId = config.primary.productionBranchId;
        }
      },
      (state: ReturnType<typeof ownedState>) => {
        if (state.primary) {
          state.primary.connection =
            "postgresql://owner:secret@ep-production.eu.neon.tech/development";
        }
      },
    ]) {
      const state = ownedState();
      change(state);
      expect(() =>
        workspaceEnvironment(
          { CONDUCTOR_WORKSPACE_ID: "workspace-one" },
          state,
          config,
        ),
      ).toThrow();
    }
  });

  it("refuses a shared project or production as the canonical development target", () => {
    expect(() =>
      parseDatabaseConfig({ ...config, security: config.primary }),
    ).toThrow("separate projects");
    expect(() =>
      parseDatabaseConfig({
        ...config,
        primary: {
          ...config.primary,
          developmentBranchId: config.primary.productionBranchId,
        },
      }),
    ).toThrow("must not be production");
  });
});
