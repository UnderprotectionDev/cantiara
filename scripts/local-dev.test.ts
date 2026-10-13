import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

const bunExecutable = execFileSync("bun", ["-p", "process.execPath"], {
  encoding: "utf8",
}).trim();
const folders: string[] = [];

afterEach(() => {
  for (const folder of folders.splice(0)) {
    rmSync(folder, { recursive: true, force: true });
  }
});

function developmentFixture() {
  const folder = mkdtempSync(join(tmpdir(), "cantiara-development-"));
  folders.push(folder);
  const bin = join(folder, "bin");
  const turboBin = join(folder, "node_modules", ".bin");
  mkdirSync(bin);
  mkdirSync(turboBin, { recursive: true });
  const calls = join(folder, "calls");
  for (const executable of [join(bin, "bun"), join(turboBin, "turbo")]) {
    writeFileSync(
      executable,
      '#!/bin/sh\nprintf "%s\\n" "$0 $*|$DATABASE_URL|$SECURITY_EVENT_DATABASE_URL|$NEON_API_KEY|$NEON_SECURITY_API_KEY" >> "$DEVELOPMENT_TEST_CALLS"\nexit "$DEVELOPMENT_TEST_EXIT_STATUS"\n',
    );
    chmodSync(executable, 0o700);
  }
  const environment = {
    PATH: `${bin}:${process.env.PATH}`,
    DATABASE_URL:
      "postgres://app:secret@ep-development-pooler.neon.tech/cantiara",
    SECURITY_EVENT_DATABASE_URL:
      "postgres://security:secret@ep-security-pooler.neon.tech/events",
    NEON_API_KEY: "neon-management-secret",
    NEON_SECURITY_API_KEY: "security-management-secret",
    CONDUCTOR_ROOT_PATH: join(folder, "missing-root"),
    CONDUCTOR_WORKSPACE_PATH: join(folder, "missing-workspace"),
    DEVELOPMENT_TEST_CALLS: calls,
    DEVELOPMENT_TEST_EXIT_STATUS: "0",
  };
  return { folder, calls, environment };
}

function runDevelopment(
  fixture: ReturnType<typeof developmentFixture>,
  arguments_: string[],
  environment: Record<string, string | undefined> = fixture.environment,
) {
  return spawnSync(
    bunExecutable,
    [fileURLToPath(new URL("./local-dev.ts", import.meta.url)), ...arguments_],
    {
      cwd: fixture.folder,
      env: environment,
      encoding: "utf8",
      timeout: 10_000,
    },
  );
}

test("development startup launches Turbo without a duplicate database check", () => {
  const fixture = developmentFixture();
  const result = runDevelopment(fixture, ["server"]);
  expect(result.status, result.stderr).toBe(0);
  const calls = readFileSync(fixture.calls, "utf8").trim().split("\n");
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain("turbo run dev -F server --");
  expect(calls[0]).toContain(fixture.environment.DATABASE_URL);
  expect(calls[0]).toContain(fixture.environment.SECURITY_EVENT_DATABASE_URL);
  expect(calls[0].split("|").slice(-2)).toEqual(["", ""]);
  expect(calls[0]).not.toContain("management-secret");
});

test("development startup propagates application failure without a root database check", () => {
  const fixture = developmentFixture();
  const result = runDevelopment(fixture, ["server"], {
    ...fixture.environment,
    DEVELOPMENT_TEST_EXIT_STATUS: "1",
  });
  expect(result.status, result.stderr).toBe(1);
  const calls = readFileSync(fixture.calls, "utf8").trim().split("\n");
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain("turbo run dev -F server --");
});

test("development help starts the tool without database configuration or readiness checks", () => {
  const fixture = developmentFixture();
  const result = runDevelopment(fixture, ["--help"], {
    PATH: fixture.environment.PATH,
    NEON_API_KEY: fixture.environment.NEON_API_KEY,
    NEON_SECURITY_API_KEY: fixture.environment.NEON_SECURITY_API_KEY,
    DEVELOPMENT_TEST_CALLS: fixture.calls,
    DEVELOPMENT_TEST_EXIT_STATUS: "0",
  });
  expect(result.status, result.stderr).toBe(0);
  const calls = readFileSync(fixture.calls, "utf8").trim().split("\n");
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain("turbo run dev --help");
  expect(calls[0]).not.toContain("management-secret");
});
