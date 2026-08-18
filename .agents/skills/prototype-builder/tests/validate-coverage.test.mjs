import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const validator = path.resolve(testDirectory, "../scripts/validate-coverage.mjs");
const skillRoot = path.resolve(testDirectory, "..");

function alternatives(verification = "passed") {
  return Object.fromEntries(
    ["a", "b", "c"].map((key) => [
      key,
      {
        route: `/alternative-${key}`,
        experience: {
          screens: [`Selection surface ${key.toUpperCase()}`],
          flows: [],
          content: [],
          interactions: ["Select an item"],
        },
        evidence: `Selection updates alternative ${key.toUpperCase()}.`,
        verification,
      },
    ]),
  );
}

function validDocument() {
  return {
    version: 2,
    prototype: {
      name: "Selection prototype",
      surface: "desktop-web",
      viewport: { width: 1440, height: 1024 },
    },
    sources: [
      {
        id: "SRC-001",
        path: "feature.md",
        role: "primary",
        locator: "Selection flow",
        status: "read",
      },
      {
        id: "SRC-002",
        path: "constraints.md",
        role: "constraint",
        locator: "Storage",
        status: "read",
      },
    ],
    requirements: [
      {
        id: "REQ-001",
        statement: "The user can select an item.",
        kind: "interaction",
        sourceIds: ["SRC-001"],
        locators: [{ sourceId: "SRC-001", locator: "Selection flow > Select" }],
        prototypeStatus: "implemented",
        decisionNote: null,
        decisionSourceIds: [],
        alternatives: alternatives(),
      },
      {
        id: "REQ-002",
        statement: "Selections are stored by the production service.",
        kind: "constraint",
        sourceIds: ["SRC-002"],
        locators: [{ sourceId: "SRC-002", locator: "Storage > Persistence" }],
        prototypeStatus: "non-visual",
        decisionNote: null,
        decisionSourceIds: [],
        nonVisualReason: "Production persistence is outside the frontend prototype.",
      },
    ],
  };
}

function runValidator(document, stage, extraArguments = []) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "prototype-validator-"));
  const inputPath = path.join(temporaryDirectory, "requirements.json");
  const outputPath = path.join(temporaryDirectory, "coverage.md");
  fs.writeFileSync(inputPath, `${JSON.stringify(document, null, 2)}\n`);

  const result = spawnSync(
    process.execPath,
    [
      validator,
      inputPath,
      "--stage",
      stage,
      ...extraArguments.map((argument) =>
        argument === "<coverage.md>" ? outputPath : argument,
      ),
    ],
    { encoding: "utf8" },
  );
  const report = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : null;
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  return { ...result, report };
}

test("extraction accepts a visible requirement before alternatives are mapped", () => {
  const document = validDocument();
  delete document.requirements[0].alternatives;

  const result = runValidator(document, "extraction");

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Coverage passed at extraction stage/);
});

test("draft accepts pending and blocked evidence and writes an honest report", () => {
  const document = validDocument();
  document.requirements[0].alternatives.a.verification = "pending";
  document.requirements[0].alternatives.c.verification = "blocked";

  const result = runValidator(document, "draft", ["--write", "<coverage.md>"]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.report, /- Stage: draft/);
  assert.match(result.report, /pending: \/alternative-a/);
  assert.match(result.report, /blocked: \/alternative-c/);
});

test("final accepts only fully passed mapped coverage", () => {
  const result = runValidator(validDocument(), "final");

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Coverage passed at final stage/);
});

test("final rejects pending verification", () => {
  const document = validDocument();
  document.requirements[0].alternatives.b.verification = "pending";

  const result = runValidator(document, "final");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /verification must be passed at final stage/);
});

test("draft rejects an unmapped visible requirement", () => {
  const document = validDocument();
  delete document.requirements[0].alternatives;

  const result = runValidator(document, "draft");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /alternatives must be an object/);
});

test("extraction rejects a partial alternatives object", () => {
  const document = validDocument();
  delete document.requirements[0].alternatives.b;

  const result = runValidator(document, "extraction");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /alternatives\.b must be an object/);
});

test("routes must equal their canonical alternative route", () => {
  const document = validDocument();
  document.requirements[0].alternatives.a.route = "/alternative-a-preview";

  const result = runValidator(document, "draft");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /route must equal \/alternative-a/);
});

test("the closed contract rejects unknown and status-incompatible fields", () => {
  const document = validDocument();
  document.requirements[0].notes = "out of contract";
  document.requirements[1].alternatives = alternatives();

  const result = runValidator(document, "draft");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /requirements\[0\]\.notes is not allowed/);
  assert.match(result.stderr, /requirements\[1\]\.alternatives is not allowed/);
});

test("every requirement source needs a precise locator and every source needs use", () => {
  const document = validDocument();
  document.sources.push({
    id: "SRC-003",
    path: "unused.md",
    role: "context",
    locator: "Background",
    status: "read",
  });
  document.requirements[0].sourceIds.push("SRC-002");

  const result = runValidator(document, "draft");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /locators must cover source SRC-002/);
  assert.match(result.stderr, /source SRC-003 must be used/);
});

test("identifier and mapping arrays reject zero ids and duplicate values", () => {
  const document = validDocument();
  document.requirements[0].id = "REQ-000";
  document.requirements[0].sourceIds.push("SRC-001");
  document.requirements[0].alternatives.a.experience.screens.push(
    "Selection surface A",
  );

  const result = runValidator(document, "draft");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /id must match REQ-001/);
  assert.match(result.stderr, /sourceIds\[1\] duplicates/);
  assert.match(result.stderr, /screens\[1\] duplicates/);
});

test("CLI rejects ambiguous stages and unknown flags", () => {
  const missingStage = spawnSync(process.execPath, [validator, "requirements.json"], {
    encoding: "utf8",
  });
  const unknownFlag = spawnSync(
    process.execPath,
    [validator, "requirements.json", "--stage", "draft", "--allow-pending"],
    { encoding: "utf8" },
  );

  assert.equal(missingStage.status, 2);
  assert.match(missingStage.stderr, /--stage is required/);
  assert.equal(unknownFlag.status, 2);
  assert.match(unknownFlag.stderr, /Unknown option: --allow-pending/);
});

test("CLI refuses to overwrite requirements.json with the coverage report", () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "prototype-validator-"));
  const inputPath = path.join(temporaryDirectory, "requirements.json");
  fs.writeFileSync(inputPath, `${JSON.stringify(validDocument(), null, 2)}\n`);

  const result = spawnSync(
    process.execPath,
    [validator, inputPath, "--stage", "draft", "--write", inputPath],
    { encoding: "utf8" },
  );
  const preserved = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--write path must differ/);
  assert.equal(preserved.version, 2);
});

test("explicit invocation metadata agrees across skill and UI contracts", () => {
  const skill = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
  const metadata = fs.readFileSync(path.join(skillRoot, "agents/openai.yaml"), "utf8");
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1] ?? "";
  const shortDescription =
    metadata.match(/^\s+short_description:\s*"([^"]+)"$/m)?.[1] ?? "";

  assert.match(frontmatter, /^name:\s*prototype-builder$/m);
  assert.match(frontmatter, /^disable-model-invocation:\s*true$/m);
  assert.doesNotMatch(description, /\$prototype-builder|çağrı|kullanma/i);
  assert.match(metadata, /^\s+allow_implicit_invocation:\s*false$/m);
  assert.match(metadata, /default_prompt:\s*"\$prototype-builder\b/);
  assert.ok(shortDescription.length >= 25 && shortDescription.length <= 64);
});
