import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { developmentCommand } from "./local-dev-command";

const root = fileURLToPath(new URL("../", import.meta.url));

test("development help keeps Turbo arguments and does not require a database", () => {
  const result = spawnSync("bun", ["scripts/local-dev.ts", "--help"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: "invalid-private-secret" },
    encoding: "utf8",
    timeout: 10_000,
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Run tasks across projects");
  expect(result.stderr).not.toContain("private-secret");
});

test("forwards server arguments after the Turbo separator", () => {
  expect(developmentCommand(["server", "--", "--port", "3200"])).toEqual({
    command: [
      "./node_modules/.bin/turbo",
      "run",
      "dev",
      "-F",
      "server",
      "--",
      "--port",
      "3200",
    ],
    requiresDatabase: true,
  });
});

test("preserves development task flags without treating them as task names", () => {
  const result = developmentCommand(["--filter=web", "--concurrency=4"]);
  expect(result.command.slice(-2)).toEqual(["--filter=web", "--concurrency=4"]);
  expect(result.requiresDatabase).toBe(true);
});

test("server help reaches Turbo instead of starting the server", () => {
  expect(developmentCommand(["server", "--help"])).toEqual({
    command: [
      "./node_modules/.bin/turbo",
      "run",
      "dev",
      "-F",
      "server",
      "--help",
    ],
    requiresDatabase: false,
  });
});
