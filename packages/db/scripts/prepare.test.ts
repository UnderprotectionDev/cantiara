import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
import type { DatabaseDiagnosis } from "./doctor";
import {
  type DatabasePreparationActions,
  prepareDevelopmentDatabases,
} from "./prepare";

type Reason = DatabaseDiagnosis["reason"];

function diagnosis(reason: Reason): DatabaseDiagnosis {
  return { reason, details: [], nextStep: "Inspect the development target." };
}

function preparation(primary: Reason, security: Reason) {
  const events: string[] = [];
  const checkSources = vi.fn(() => {
    events.push("check");
    return Promise.resolve();
  });
  const diagnose = vi
    .fn<DatabasePreparationActions["diagnose"]>()
    .mockImplementationOnce(() => {
      events.push("diagnose:primary");
      return Promise.resolve(diagnosis(primary));
    })
    .mockImplementationOnce(() => {
      events.push("diagnose:security");
      return Promise.resolve(diagnosis(security));
    })
    .mockImplementation((securityEvents) => {
      events.push(`verify:${securityEvents ? "security" : "primary"}`);
      return Promise.resolve(diagnosis("ready"));
    });
  const migrate = vi.fn((securityEvents: boolean) => {
    events.push(`migrate:${securityEvents ? "security" : "primary"}`);
    return Promise.resolve(true);
  });
  return { events, checkSources, diagnose, migrate };
}

test("checks both ready targets without applying migrations", async () => {
  const actions = preparation("ready", "ready");
  expect(await prepareDevelopmentDatabases(actions)).toBe(true);
  expect(actions.events).toEqual([
    "check",
    "diagnose:primary",
    "diagnose:security",
  ]);
  expect(actions.migrate).not.toHaveBeenCalled();
  expect(actions.diagnose.mock.calls).toEqual([[false], [true]]);
});

test.each([
  ["pending", "ready", false],
  ["ready", "pending", true],
] satisfies [Reason, Reason, boolean][])(
  "applies only the pending target (%s, %s)",
  async (primary, security, securityEvents) => {
    const actions = preparation(primary, security);
    expect(await prepareDevelopmentDatabases(actions)).toBe(true);
    expect(actions.migrate.mock.calls).toEqual([[securityEvents]]);
    expect(actions.diagnose.mock.calls).toEqual([
      [false],
      [true],
      [false],
      [true],
    ]);
  },
);

test("preflights both targets and migrates them in order before final verification", async () => {
  const actions = preparation("pending", "pending");
  expect(await prepareDevelopmentDatabases(actions)).toBe(true);
  expect(actions.events).toEqual([
    "check",
    "diagnose:primary",
    "diagnose:security",
    "migrate:primary",
    "migrate:security",
    "verify:primary",
    "verify:security",
  ]);
});

const blockers: Reason[] = [
  "ahead",
  "history-mismatch",
  "schema-drift",
  "target-mismatch",
  "connection",
  "permission",
  "repository",
  "migration-running",
];

test.each(blockers)(
  "applies nothing when either target reports %s",
  async (reason) => {
    const boundaries = [
      [reason, "pending"],
      ["pending", reason],
    ] satisfies [Reason, Reason][];
    await Promise.all(
      boundaries.map(async ([primary, security]) => {
        const actions = preparation(primary, security);
        expect(await prepareDevelopmentDatabases(actions)).toBe(false);
        expect(actions.migrate).not.toHaveBeenCalled();
        expect(actions.diagnose).toHaveBeenCalledTimes(2);
      }),
    );
  },
);

test("does not inspect or migrate databases when source checks fail", async () => {
  const actions = preparation("pending", "pending");
  actions.checkSources.mockRejectedValueOnce(new Error("Missing migration"));
  await expect(prepareDevelopmentDatabases(actions)).rejects.toThrow(
    "Missing migration",
  );
  expect(actions.diagnose).not.toHaveBeenCalled();
  expect(actions.migrate).not.toHaveBeenCalled();
});

test("stops after a failed primary migration without applying the security migration", async () => {
  const actions = preparation("pending", "pending");
  actions.migrate.mockResolvedValueOnce(false);
  expect(await prepareDevelopmentDatabases(actions)).toBe(false);
  expect(actions.migrate.mock.calls).toEqual([[false]]);
  expect(actions.diagnose).toHaveBeenCalledTimes(2);
});

test("does not report readiness when the second migration fails", async () => {
  const actions = preparation("pending", "pending");
  actions.migrate.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  expect(await prepareDevelopmentDatabases(actions)).toBe(false);
  expect(actions.migrate.mock.calls).toEqual([[false], [true]]);
  expect(actions.diagnose).toHaveBeenCalledTimes(2);
});

test.each(["pending", ...blockers])(
  "does not report readiness when final verification reports %s",
  async (reason) => {
    const actions = preparation("pending", "ready");
    actions.diagnose
      .mockReset()
      .mockResolvedValueOnce(diagnosis("pending"))
      .mockResolvedValueOnce(diagnosis("ready"))
      .mockResolvedValueOnce(diagnosis("ready"))
      .mockResolvedValueOnce(diagnosis(reason));
    expect(await prepareDevelopmentDatabases(actions)).toBe(false);
    expect(actions.migrate.mock.calls).toEqual([[false]]);
  },
);

function preparationCommand(
  arguments_: string[],
  environment: Record<string, string | undefined> = {},
) {
  return spawnSync(
    "bun",
    [fileURLToPath(new URL("./prepare.ts", import.meta.url)), ...arguments_],
    {
      env: {
        ...process.env,
        NODE_ENV: undefined,
        CANTIARA_DEPLOY_MIGRATION: undefined,
        DATABASE_URL: "not-a-url-private-secret",
        SECURITY_EVENT_DATABASE_URL: "not-a-url-security-secret",
        ...environment,
      },
      encoding: "utf8",
      timeout: 10_000,
    },
  );
}

test.each(["--help", "-h"])(
  "preparation help (%s) works without database configuration",
  (argument) => {
    const result = preparationCommand([argument]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Usage: bun run db:prepare");
    expect(result.stdout).not.toContain("private-secret");
    expect(result.stdout).not.toContain("security-secret");
  },
);

test.each(["--deployment", "--security-events", "--force"])(
  "rejects unsupported preparation arguments (%s) before inspecting targets",
  (argument) => {
    const result = preparationCommand([argument]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unsupported preparation arguments");
    expect(result.stdout).toBe("");
  },
);

test.each([{ CANTIARA_DEPLOY_MIGRATION: "true" }, { NODE_ENV: "production" }])(
  "rejects a deployment environment (%j)",
  (environment) => {
    const result = preparationCommand([], environment);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("requires a development environment");
    expect(result.stdout).toBe("");
  },
);
