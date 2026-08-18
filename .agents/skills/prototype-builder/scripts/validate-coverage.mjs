#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const stages = new Set(["extraction", "draft", "final"]);
const statuses = new Set(["implemented", "simulated", "non-visual"]);
const verifications = new Set(["pending", "passed", "blocked"]);
const sourceRoles = new Set(["primary", "constraint", "visual", "context"]);
const requirementKinds = new Set([
  "flow",
  "screen",
  "content",
  "interaction",
  "visual",
  "constraint",
]);
const alternativeKeys = ["a", "b", "c"];
const experienceKeys = ["screens", "flows", "content", "interactions"];
const commonRequirementKeys = [
  "id",
  "statement",
  "kind",
  "sourceIds",
  "locators",
  "prototypeStatus",
  "decisionNote",
  "decisionSourceIds",
];

const usage =
  "Usage: node validate-coverage.mjs <requirements.json> --stage <extraction|draft|final> [--write <coverage.md>]";

function failUsage(message) {
  if (message) console.error(message);
  console.error(usage);
  process.exit(2);
}

function parseArguments(args) {
  if (args.includes("--help")) {
    console.log(usage);
    process.exit(0);
  }

  let inputPath = null;
  let outputPath = null;
  let stage = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--stage" || argument === "--write") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        failUsage(`${argument} requires a value`);
      }
      if (argument === "--stage") {
        if (stage !== null) failUsage("--stage may be provided only once");
        stage = value;
      } else {
        if (outputPath !== null) failUsage("--write may be provided only once");
        outputPath = value;
      }
      index += 1;
      continue;
    }

    if (argument.startsWith("-")) failUsage(`Unknown option: ${argument}`);
    if (inputPath !== null) failUsage(`Unexpected positional argument: ${argument}`);
    inputPath = argument;
  }

  if (!inputPath) failUsage("requirements.json path is required");
  if (!stage) failUsage("--stage is required");
  if (!stages.has(stage)) failUsage(`Unknown stage: ${stage}`);

  return { inputPath, outputPath, stage };
}

const { inputPath, outputPath, stage } = parseArguments(process.argv.slice(2));

if (outputPath && path.resolve(inputPath) === path.resolve(outputPath)) {
  failUsage("--write path must differ from requirements.json path");
}

let document;
try {
  document = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
} catch (error) {
  console.error(`Could not read requirements JSON: ${error.message}`);
  process.exit(2);
}

const errors = [];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, location) {
  if (!isPlainObject(value)) {
    errors.push(`${location} must be an object`);
    return false;
  }
  return true;
}

function requireExactKeys(value, allowedKeys, location) {
  if (!requireObject(value, location)) return false;
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${location}.${key} is not allowed`);
  }
  return true;
}

function requireText(value, location) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${location} must be a non-empty string`);
    return false;
  }
  return true;
}

function requireArray(value, location, minimum = 0) {
  if (!Array.isArray(value)) {
    errors.push(`${location} must be an array`);
    return false;
  }
  if (value.length < minimum) {
    errors.push(`${location} must contain at least ${minimum} item(s)`);
  }
  return true;
}

function requireTextArray(value, location, minimum = 0) {
  if (!requireArray(value, location, minimum)) return false;

  const seen = new Set();
  for (const [index, item] of value.entries()) {
    if (!requireText(item, `${location}[${index}]`)) continue;
    const normalized = item.trim();
    if (seen.has(normalized)) {
      errors.push(`${location}[${index}] duplicates ${JSON.stringify(normalized)}`);
    }
    seen.add(normalized);
  }
  return value.length >= minimum;
}

function requireId(value, expression, example, location) {
  if (typeof value !== "string" || !expression.test(value)) {
    errors.push(`${location} must match ${example}`);
    return false;
  }
  return true;
}

requireExactKeys(document, ["version", "prototype", "sources", "requirements"], "root");

if (document?.version !== 2) errors.push("version must equal 2");

const prototype = document?.prototype;
if (requireExactKeys(prototype, ["name", "surface", "viewport"], "prototype")) {
  requireText(prototype.name, "prototype.name");
  if (prototype.surface !== "desktop-web") {
    errors.push('prototype.surface must equal "desktop-web"');
  }
  if (
    requireExactKeys(prototype.viewport, ["width", "height"], "prototype.viewport") &&
    (prototype.viewport.width !== 1440 || prototype.viewport.height !== 1024)
  ) {
    errors.push("prototype.viewport must equal 1440x1024");
  }
}

const sources = Array.isArray(document?.sources) ? document.sources : [];
const requirements = Array.isArray(document?.requirements) ? document.requirements : [];
requireArray(document?.sources, "sources", 1);
requireArray(document?.requirements, "requirements", 1);

const sourceIds = new Set();
const sourceUsage = new Map();

for (const [index, source] of sources.entries()) {
  const location = `sources[${index}]`;
  requireExactKeys(source, ["id", "path", "role", "locator", "status"], location);

  if (
    requireId(source?.id, /^SRC-(?!0+$)\d{3,}$/, "SRC-001", `${location}.id`)
  ) {
    if (sourceIds.has(source.id)) {
      errors.push(`${location}.id duplicates ${source.id}`);
    } else {
      sourceIds.add(source.id);
      sourceUsage.set(source.id, 0);
    }
  }
  requireText(source?.path, `${location}.path`);
  if (!sourceRoles.has(source?.role)) {
    errors.push(`${location}.role must be primary, constraint, visual, or context`);
  }
  requireText(source?.locator, `${location}.locator`);
  if (source?.status !== "read") errors.push(`${location}.status must equal "read"`);
}

const requirementIds = new Set();

for (const [index, requirement] of requirements.entries()) {
  const location = `requirements[${index}]`;
  const requirementIsObject = requireObject(requirement, location);
  const prototypeStatus = requirement?.prototypeStatus;
  const allowedRequirementKeys = statuses.has(prototypeStatus)
    ? prototypeStatus === "non-visual"
      ? [...commonRequirementKeys, "nonVisualReason"]
      : [...commonRequirementKeys, "alternatives"]
    : [...commonRequirementKeys, "alternatives", "nonVisualReason"];
  if (requirementIsObject) {
    requireExactKeys(requirement, allowedRequirementKeys, location);
  }

  if (
    requireId(requirement?.id, /^REQ-(?!0+$)\d{3,}$/, "REQ-001", `${location}.id`)
  ) {
    if (requirementIds.has(requirement.id)) {
      errors.push(`${location}.id duplicates ${requirement.id}`);
    } else {
      requirementIds.add(requirement.id);
    }
  }

  requireText(requirement?.statement, `${location}.statement`);
  if (!requirementKinds.has(requirement?.kind)) {
    errors.push(
      `${location}.kind must be flow, screen, content, interaction, visual, or constraint`,
    );
  }

  const requirementSourceIds = Array.isArray(requirement?.sourceIds)
    ? requirement.sourceIds
    : [];
  if (requireTextArray(requirement?.sourceIds, `${location}.sourceIds`, 1)) {
    for (const sourceId of requirementSourceIds) {
      if (!sourceIds.has(sourceId)) {
        errors.push(`${location}.sourceIds references unknown ${sourceId}`);
      } else {
        sourceUsage.set(sourceId, (sourceUsage.get(sourceId) ?? 0) + 1);
      }
    }
  }

  const locatorSourceIds = new Set();
  const seenLocators = new Set();
  if (requireArray(requirement?.locators, `${location}.locators`, 1)) {
    for (const [locatorIndex, locator] of requirement.locators.entries()) {
      const locatorLocation = `${location}.locators[${locatorIndex}]`;
      requireExactKeys(locator, ["sourceId", "locator"], locatorLocation);
      const locatorSourceId = locator?.sourceId;
      if (!sourceIds.has(locatorSourceId)) {
        errors.push(`${locatorLocation}.sourceId references unknown ${locatorSourceId}`);
      } else if (!requirementSourceIds.includes(locatorSourceId)) {
        errors.push(`${locatorLocation}.sourceId must appear in ${location}.sourceIds`);
      } else {
        locatorSourceIds.add(locatorSourceId);
      }
      if (requireText(locator?.locator, `${locatorLocation}.locator`)) {
        const locatorKey = `${locatorSourceId}\u0000${locator.locator.trim()}`;
        if (seenLocators.has(locatorKey)) {
          errors.push(`${locatorLocation} duplicates a source and locator pair`);
        }
        seenLocators.add(locatorKey);
      }
    }
  }
  for (const sourceId of new Set(requirementSourceIds)) {
    if (sourceIds.has(sourceId) && !locatorSourceIds.has(sourceId)) {
      errors.push(`${location}.locators must cover source ${sourceId}`);
    }
  }

  const decisionNote = requirement?.decisionNote;
  if (decisionNote !== null) requireText(decisionNote, `${location}.decisionNote`);
  const decisionSourceIds = Array.isArray(requirement?.decisionSourceIds)
    ? requirement.decisionSourceIds
    : [];
  if (requireTextArray(requirement?.decisionSourceIds, `${location}.decisionSourceIds`)) {
    if (decisionNote === null && decisionSourceIds.length > 0) {
      errors.push(`${location}.decisionSourceIds must be empty when decisionNote is null`);
    }
    if (
      typeof decisionNote === "string" &&
      decisionNote.trim() !== "" &&
      decisionSourceIds.length === 0
    ) {
      errors.push(
        `${location}.decisionSourceIds must contain at least one source id when decisionNote is set`,
      );
    }
    for (const sourceId of decisionSourceIds) {
      if (!sourceIds.has(sourceId)) {
        errors.push(`${location}.decisionSourceIds references unknown ${sourceId}`);
      } else if (!requirementSourceIds.includes(sourceId)) {
        errors.push(
          `${location}.decisionSourceIds source ${sourceId} must appear in ${location}.sourceIds`,
        );
      }
    }
  }

  if (!statuses.has(prototypeStatus)) {
    errors.push(
      `${location}.prototypeStatus must be implemented, simulated, or non-visual`,
    );
    continue;
  }

  if (prototypeStatus === "non-visual") {
    if (requirement.kind !== "constraint") {
      errors.push(`${location}.kind must be constraint when prototypeStatus is non-visual`);
    }
    requireText(requirement?.nonVisualReason, `${location}.nonVisualReason`);
    continue;
  }

  if (requirement.kind === "constraint") {
    errors.push(`${location}.kind constraint requires prototypeStatus non-visual`);
  }

  if (requirement.alternatives === undefined && stage === "extraction") continue;
  if (
    !requireExactKeys(
      requirement.alternatives,
      alternativeKeys,
      `${location}.alternatives`,
    )
  ) {
    continue;
  }

  for (const alternativeKey of alternativeKeys) {
    const alternative = requirement.alternatives[alternativeKey];
    const alternativeLocation = `${location}.alternatives.${alternativeKey}`;
    if (
      !requireExactKeys(
        alternative,
        ["route", "experience", "evidence", "verification"],
        alternativeLocation,
      )
    ) {
      continue;
    }

    const expectedRoute = `/alternative-${alternativeKey}`;
    if (alternative.route !== expectedRoute) {
      errors.push(`${alternativeLocation}.route must equal ${expectedRoute}`);
    }
    requireText(alternative.evidence, `${alternativeLocation}.evidence`);

    if (
      requireExactKeys(
        alternative.experience,
        experienceKeys,
        `${alternativeLocation}.experience`,
      )
    ) {
      for (const experienceKey of experienceKeys) {
        const minimum =
          experienceKey === "screens" ||
          (requirement.kind === "flow" && experienceKey === "flows") ||
          (requirement.kind === "content" && experienceKey === "content") ||
          (requirement.kind === "interaction" && experienceKey === "interactions")
            ? 1
            : 0;
        requireTextArray(
          alternative.experience[experienceKey],
          `${alternativeLocation}.experience.${experienceKey}`,
          minimum,
        );
      }
    }

    if (!verifications.has(alternative.verification)) {
      errors.push(
        `${alternativeLocation}.verification must be pending, passed, or blocked`,
      );
    } else if (stage === "final" && alternative.verification !== "passed") {
      errors.push(`${alternativeLocation}.verification must be passed at final stage`);
    }
  }
}

for (const [sourceId, count] of sourceUsage.entries()) {
  if (count === 0) {
    errors.push(`source ${sourceId} must be used by at least one requirement`);
  }
}

if (errors.length > 0) {
  console.error(
    `Coverage validation failed at ${stage} stage with ${errors.length} error(s):`,
  );
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const counts = requirements.reduce(
  (result, requirement) => {
    result[requirement.prototypeStatus] += 1;
    return result;
  },
  { implemented: 0, simulated: 0, "non-visual": 0 },
);

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function alternativeCell(requirement, key) {
  if (requirement.prototypeStatus === "non-visual") return "n/a";
  if (!requirement.alternatives) return "not mapped";
  const alternative = requirement.alternatives[key];
  const experience = alternative.experience;
  const compact = (items) => (items.length > 0 ? items.join(", ") : "—");
  return [
    `${alternative.verification}: ${alternative.route}`,
    `S: ${compact(experience.screens)}`,
    `F: ${compact(experience.flows)}`,
    `C: ${compact(experience.content)}`,
    `I: ${compact(experience.interactions)}`,
    `E: ${alternative.evidence}`,
  ].join("; ");
}

const rows = requirements.map((requirement) =>
  [
    requirement.id,
    requirement.prototypeStatus,
    requirement.sourceIds.join(", "),
    alternativeCell(requirement, "a"),
    alternativeCell(requirement, "b"),
    alternativeCell(requirement, "c"),
    requirement.nonVisualReason ?? "—",
    requirement.decisionNote ?? "—",
    requirement.statement,
  ]
    .map(escapeCell)
    .join(" | "),
);

const report = `# Prototype Coverage

- Stage: ${stage}
- Sources: ${sources.length}
- Requirements: ${requirements.length}
- Implemented: ${counts.implemented}
- Simulated: ${counts.simulated}
- Non-visual: ${counts["non-visual"]}
- Validation: passed

| ID | Status | Sources | A | B | C | Non-visual reason | Decision | Requirement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${row} |`).join("\n")}
`;

if (outputPath) {
  const resolvedOutput = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, report);
  console.log(`Coverage report written to ${resolvedOutput}`);
}

console.log(
  `Coverage passed at ${stage} stage: ${requirements.length} requirements across ${sources.length} sources`,
);
