import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

interface WorkflowJob {
  env?: Record<string, string>;
  if?: string;
  needs?: string[];
  services?: Record<string, { image: string }>;
  steps: {
    env?: Record<string, string>;
    if?: string;
    run?: string;
    uses?: string;
    with?: Record<string, string>;
  }[];
  strategy?: {
    "fail-fast": boolean;
    matrix: { cache?: string[]; shard?: number[] };
  };
}

const root = fileURLToPath(new URL("../", import.meta.url));
const parsed = spawnSync(
  "bun",
  [
    "-e",
    'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(".github/workflows/integration-tests.yml").text())))',
  ],
  { cwd: root, encoding: "utf8" },
);
if (parsed.status !== 0) {
  throw new Error(parsed.stderr);
}
const workflow: { jobs: Record<string, WorkflowJob | undefined> } = JSON.parse(
  parsed.stdout,
);

test("integration scheduling partitions every suite without sharing database workers", () => {
  const { jobs } = workflow;
  const server = jobs["server-integration"];
  const browser = jobs["browser-integration"];
  expect(server?.strategy?.matrix.shard).toEqual([1, 2]);
  expect(browser?.strategy?.matrix.shard).toEqual([1, 2, 3, 4, 5, 6]);
  for (const job of [server, browser]) {
    expect(job?.strategy?.["fail-fast"]).toBe(false);
    expect(job?.services?.postgres?.image).toBe("postgres:16");
    expect(job?.needs).toBeUndefined();
  }
  const commands = Object.values(jobs)
    .flatMap((job) => job?.steps ?? [])
    .map((step) => step.run ?? "")
    .join("\n");
  for (const command of [
    "bun run db:check",
    "bun run db:test -- --no-file-parallelism --fsModuleCache",
    "bun run check-types",
    "bun run --cwd apps/web test -- --fsModuleCache",
    "bun run --cwd packages/api test -- --fsModuleCache",
    "bunx vitest run scripts/ci-workflow.test.ts --fsModuleCache",
  ]) {
    expect(
      commands.split("\n").filter((line) => line.trim() === command),
    ).toHaveLength(1);
  }
  // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expressions are literal shell input.
  const matrixShard = "${{ matrix.shard }}";
  const serverCommands = server?.steps.map((step) => step.run).join("\n");
  expect(serverCommands).toContain(
    `bun run --cwd apps/server test -- --no-file-parallelism --shard=${matrixShard}/2 --fsModuleCache`,
  );
  const browserCommands = browser?.steps.map((step) => step.run).join("\n");
  expect(browserCommands).toContain("--workers=1");
  expect(browserCommands).toContain(`--shard=${matrixShard}/6`);
  expect(browserCommands).toContain(
    "Web Capture|measures Command Palette visibility at the reference workspace scale",
  );
  const extensionSteps = browser?.steps.filter((step) =>
    step.run?.includes("bun run --cwd apps/web test:e2e:extension"),
  );
  expect(extensionSteps).toHaveLength(1);
  expect(extensionSteps?.[0]?.if).toBe("matrix.shard == 1");
  const performance = jobs["command-palette-performance"];
  expect(performance?.needs).toBeUndefined();
  expect(performance?.strategy?.matrix.cache).toEqual(["hot", "cold"]);
  expect(performance?.strategy?.["fail-fast"]).toBe(false);
  expect(performance?.services?.postgres?.image).toBe("postgres:16");
  // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expressions are literal shell input.
  const matrixCache = "${{ matrix.cache }}";
  expect(performance?.steps.map((step) => step.run).join("\n")).toContain(
    `measures Command Palette visibility at the reference workspace scale: ${matrixCache}-cache$`,
  );
});

test("restored caches reuse dependencies and transforms without skipping tests", () => {
  for (const name of [
    "database-integration",
    "server-integration",
    "unit-integration",
    "browser-integration",
    "command-palette-performance",
  ]) {
    const steps = workflow.jobs[name]?.steps ?? [];
    const dependencyCacheIndex = steps.findIndex(
      (step) => step.with?.path === "~/.bun/install/cache",
    );
    const installIndex = steps.findIndex((step) =>
      step.run?.includes("bun install --frozen-lockfile"),
    );
    expect(dependencyCacheIndex).toBeGreaterThan(-1);
    expect(dependencyCacheIndex).toBeLessThan(installIndex);
    expect(steps[dependencyCacheIndex]?.uses).toBe("actions/cache@v4");
    expect(steps[dependencyCacheIndex]?.with?.key).toContain("bun.lock");
    expect(steps[installIndex]?.if).toBeUndefined();

    const tests = steps.filter((step) => step.run?.includes("--fsModuleCache"));
    if (
      name === "browser-integration" ||
      name === "command-palette-performance"
    ) {
      expect(tests).toHaveLength(0);
      continue;
    }
    expect(tests.length).toBeGreaterThan(0);
    for (const step of tests) {
      expect(step.if).toBeUndefined();
      expect(step.run).not.toContain("--no-isolate");
    }
    const transformCacheIndex = steps.findIndex(
      (step) => step.with?.path === "node_modules/.vitest-cache",
    );
    expect(transformCacheIndex).toBeGreaterThan(installIndex);
    expect(transformCacheIndex).toBeLessThan(steps.indexOf(tests[0] ?? {}));
    const transformCache = steps[transformCacheIndex];
    expect(transformCache?.uses).toBe("actions/cache@v4");
    for (const input of [
      "runner.os",
      "runner.arch",
      "bun.lock",
      "github.sha",
    ]) {
      expect(transformCache?.with?.key).toContain(input);
    }
    if (name === "server-integration") {
      expect(transformCache.with?.key).toContain("matrix.shard");
    }
    expect(transformCache?.with?.["restore-keys"]).not.toContain("github.sha");
  }
  const turboCache = workflow.jobs["unit-integration"]?.steps.find(
    (step) => step.with?.path === ".turbo",
  );
  expect(turboCache?.uses).toBe("actions/cache@v4");
  expect(turboCache?.with?.key).toContain("bun.lock");
});

test("the integration gate rejects failed, skipped and cancelled validation groups", () => {
  expect(workflow.jobs["core-integration"]).toBeUndefined();
  const expectedDependencies = {
    "integration-gate": [
      "database-integration",
      "server-integration",
      "unit-integration",
      "browser-integration",
      "command-palette-performance",
    ],
  };
  for (const [name, dependencies] of Object.entries(expectedDependencies)) {
    const job = workflow.jobs[name];
    expect(job?.needs).toEqual(dependencies);
    expect(job?.if).toBe("always()");
    const step = job?.steps.find((candidate) => candidate.run);
    expect(step?.run).toBeDefined();
    const successEnv = Object.fromEntries(
      Object.keys(step?.env ?? {}).map((key) => [key, "success"]),
    );
    expect(Object.values(step?.env ?? {})).toEqual(
      dependencies.map((dependency) => `\${{ needs.${dependency}.result }}`),
    );
    const runGate = (env: Record<string, string>) =>
      spawnSync("bash", ["-e", "-c", step?.run ?? ""], {
        env: { ...process.env, ...env },
        encoding: "utf8",
      }).status;
    expect(runGate(successEnv)).toBe(0);
    for (const key of Object.keys(successEnv)) {
      for (const result of ["failure", "skipped", "cancelled"]) {
        expect(runGate({ ...successEnv, [key]: result })).toBe(1);
      }
    }
  }
});

test("each performance runner selects exactly its own cache measurement", () => {
  const discovery = spawnSync(
    "bun",
    [
      "run",
      "test:e2e",
      "--",
      "--list",
      "--reporter=json",
      "--grep",
      "measures Command Palette visibility at the reference workspace scale",
    ],
    { cwd: root, encoding: "utf8" },
  );
  expect(discovery.status, discovery.stderr).toBe(0);
  interface Suite {
    specs?: { title: string }[];
    suites?: Suite[];
  }
  const report: { suites: Suite[] } = JSON.parse(discovery.stdout);
  const titles = (suites: Suite[]): string[] =>
    suites.flatMap((suite) => [
      ...(suite.specs ?? []).map((spec) => spec.title),
      ...titles(suite.suites ?? []),
    ]);
  expect(titles(report.suites).sort()).toEqual([
    "measures Command Palette visibility at the reference workspace scale: cold-cache",
    "measures Command Palette visibility at the reference workspace scale: hot-cache",
  ]);
});
