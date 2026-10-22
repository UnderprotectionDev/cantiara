// bun scripts/check-conventions.ts [--staged | --base <ref> | --all]
//
// Fails when a change adds a violation of the mechanical rules in
// structure.md and docs/tech-stack.md. Each changed file is compared with its
// base version under the current documents, so existing deviations pass and
// only violations the change adds fail. Rules are read from the documents of
// the checked side (index or working tree), so a documented exception added
// in the same change applies to it.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { checkFile, newViolations, type Violation } from "./convention-check";
import {
  type ConventionRules,
  ConventionRulesError,
  readConventionRules,
} from "./convention-rules";

const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const CHECKED_FILE = /(\.tsx?|\.css|(^|\/)package\.json)$/;

function git(cwd: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function show(cwd: string, revision: string, path: string) {
  const result = git(cwd, ["show", `${revision}:${path}`]);
  return result.ok ? result.stdout : undefined;
}

interface Change {
  basePath: string | undefined;
  path: string;
}

function parseNameStatus(output: string) {
  const fields = output.split("\0").filter(Boolean);
  const changes: Change[] = [];
  for (let index = 0; index < fields.length; ) {
    const status = fields[index] ?? "";
    if (status.startsWith("R")) {
      changes.push({
        basePath: fields[index + 1],
        path: fields[index + 2] ?? "",
      });
      index += 3;
    } else if (status.startsWith("C")) {
      changes.push({ basePath: undefined, path: fields[index + 2] ?? "" });
      index += 3;
    } else {
      const path = fields[index + 1] ?? "";
      if (!status.startsWith("D")) {
        changes.push({
          basePath: status.startsWith("A") ? undefined : path,
          path,
        });
      }
      index += 2;
    }
  }
  return changes;
}

interface Side {
  base: string;
  changes: Change[];
  label: string;
  read: (path: string) => string | undefined;
}

function stagedSide(cwd: string): Side {
  const head = git(cwd, ["rev-parse", "--verify", "-q", "HEAD"]).ok
    ? "HEAD"
    : EMPTY_TREE;
  const diff = git(cwd, [
    "diff",
    "--cached",
    "--name-status",
    "-M",
    "-z",
    head,
  ]);
  return {
    base: head,
    changes: parseNameStatus(diff.stdout),
    label: "staged changes against HEAD",
    read: (path) => show(cwd, "", path),
  };
}

function workingTreeSide(cwd: string, ref: string): Side {
  const mergeBase = git(cwd, ["merge-base", ref, "HEAD"]);
  if (!mergeBase.ok) {
    throw new Error(
      `Cannot find the merge base of ${ref} and HEAD; fetch ${ref} or pass --base <ref>.`,
    );
  }
  const base = mergeBase.stdout.trim();
  const diff = git(cwd, ["diff", "--name-status", "-M", "-z", base]);
  const untracked = git(cwd, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ]);
  const changes = [
    ...parseNameStatus(diff.stdout),
    ...untracked.stdout
      .split("\0")
      .filter(Boolean)
      .map((path) => ({ basePath: undefined, path })),
  ];
  return {
    base,
    changes,
    label: `changes since ${ref} (${base.slice(0, 8)})`,
    read: (path) => {
      const file = join(cwd, path);
      return existsSync(file) ? readFileSync(file, "utf8") : undefined;
    },
  };
}

function allFilesSide(cwd: string): Side {
  const files = git(cwd, ["ls-files", "-z"]).stdout.split("\0").filter(Boolean);
  return {
    base: EMPTY_TREE,
    changes: files.map((path) => ({ basePath: undefined, path })),
    label: "every tracked file (existing deviations included)",
    read: (path) => {
      const file = join(cwd, path);
      return existsSync(file) ? readFileSync(file, "utf8") : undefined;
    },
  };
}

function readRules(read: (path: string) => string | undefined) {
  return readConventionRules((path) => {
    const content = read(path);
    if (content === undefined) {
      throw new ConventionRulesError(path, "the document is missing");
    }
    return content;
  });
}

function exceptionNotes(
  cwd: string,
  side: Side,
  rules: ConventionRules,
): Violation[] {
  let baseRules: ConventionRules;
  try {
    baseRules = readRules((path) => show(cwd, side.base, path));
  } catch {
    return [];
  }
  const known = new Set(
    baseRules.structure.approvedExceptions.map((exception) => exception.path),
  );
  return rules.structure.approvedExceptions
    .filter((exception) => !known.has(exception.path))
    .map((exception) => ({
      file: "structure.md",
      key: `exception:${exception.path}`,
      line: 1,
      message: `New Approved exception \`${exception.path}\` (${exception.reason}); a reviewer confirms the reason.`,
      rule: "approved-exception",
      severity: "review" as const,
      source: "structure.md › Approved exceptions",
    }));
}

/** A change that removes a documented rule is a review decision, not silent. */
function weakenedRuleNotes(
  cwd: string,
  side: Side,
  rules: ConventionRules,
): Violation[] {
  let baseRules: ConventionRules;
  try {
    baseRules = readRules((path) => show(cwd, side.base, path));
  } catch {
    return [];
  }
  const note = (key: string, message: string, file: string): Violation => ({
    file,
    key: `weakened:${key}`,
    line: 1,
    message,
    rule: "rule-removed",
    severity: "review",
    source: `${file} › Enforcement`,
  });
  const headBans = new Set(rules.stack.bans.map((ban) => ban.id));
  const headFolders = new Set(
    rules.structure.web.folders.map((folder) => folder.folder),
  );
  const headNames = new Set(
    rules.structure.web.folders.map((folder) => folder.namePatternSource),
  );
  return [
    ...baseRules.stack.bans
      .filter((ban) => !headBans.has(ban.id))
      .map((ban) =>
        note(
          ban.id,
          `The ${ban.tech} sentence behind \`${ban.id}\` is gone from docs/tech-stack.md, so the check no longer enforces it; a reviewer confirms the rule was meant to go.`,
          "docs/tech-stack.md",
        ),
      ),
    ...baseRules.structure.web.folders
      .filter(
        (folder) =>
          !headFolders.has(folder.folder) ||
          (folder.namePatternSource &&
            !headNames.has(folder.namePatternSource)),
      )
      .map((folder) =>
        note(
          folder.folder,
          `Feature folder rule \`${folder.folder}\` was removed or renamed in structure.md; a reviewer confirms the layout change.`,
          "structure.md",
        ),
      ),
    ...(baseRules.stack.forms.requireUseForm &&
    !rules.stack.forms.requireUseForm
      ? [
          note(
            "use-form",
            "The TanStack Form row no longer requires `useForm`; a reviewer confirms.",
            "docs/tech-stack.md",
          ),
        ]
      : []),
  ];
}

function newFeatureNotes(cwd: string, side: Side, rules: ConventionRules) {
  const roots = [
    rules.structure.web.featureRoot,
    rules.structure.server.featureRoot,
  ];
  const notes = new Map<string, Violation>();
  for (const change of side.changes) {
    const root = roots.find((candidate) => change.path.startsWith(candidate));
    const feature = root
      ? change.path.slice(root.length).split("/")[0]
      : undefined;
    if (!(root && feature) || notes.has(`${root}${feature}`)) {
      continue;
    }
    const existing = git(cwd, [
      "ls-tree",
      "-d",
      "--name-only",
      side.base,
      `${root}${feature}`,
    ]);
    if (existing.stdout.trim()) {
      continue;
    }
    notes.set(`${root}${feature}`, {
      file: `${root}${feature}/`,
      key: `feature:${root}${feature}`,
      line: 1,
      message: `New feature folder \`${feature}\`: confirm it is a product capability whose UI, server, contract and schema change together, and that its term is in CONTEXT.md.`,
      rule: "new-feature",
      severity: "review",
      source: "structure.md › Rules › Feature",
    });
  }
  return [...notes.values()];
}

export function runConventionCheck(cwd: string, argv: string[]) {
  let side: Side;
  if (argv.includes("--staged")) {
    side = stagedSide(cwd);
  } else if (argv.includes("--all")) {
    side = allFilesSide(cwd);
  } else {
    const baseIndex = argv.indexOf("--base");
    const ref =
      baseIndex >= 0
        ? (argv[baseIndex + 1] ?? "")
        : (["origin/main", "main"].find(
            (candidate) =>
              git(cwd, ["rev-parse", "--verify", "-q", candidate]).ok,
          ) ?? "HEAD");
    side = workingTreeSide(cwd, ref);
  }

  const rules = readRules(side.read);
  const found: Violation[] = [];
  for (const change of side.changes) {
    if (!CHECKED_FILE.test(change.path)) {
      continue;
    }
    const content = side.read(change.path);
    if (content === undefined) {
      continue;
    }
    const head = checkFile(change.path, content, rules);
    const baseContent = change.basePath
      ? show(cwd, side.base, change.basePath)
      : undefined;
    const base =
      change.basePath && baseContent !== undefined
        ? checkFile(change.basePath, baseContent, rules)
        : [];
    found.push(...newViolations(head, base));
  }
  if (!argv.includes("--all")) {
    found.push(
      ...exceptionNotes(cwd, side, rules),
      ...weakenedRuleNotes(cwd, side, rules),
      ...newFeatureNotes(cwd, side, rules),
    );
  }
  return { label: side.label, violations: found };
}

function format(entry: Violation) {
  return `${entry.severity === "error" ? "error " : "review"} ${entry.file}:${entry.line} [${entry.rule}] ${entry.message}\n       ↳ ${entry.source}`;
}

if (import.meta.main) {
  const root = git(process.cwd(), [
    "rev-parse",
    "--show-toplevel",
  ]).stdout.trim();
  try {
    const { label, violations } = runConventionCheck(
      root,
      process.argv.slice(2),
    );
    const errors = violations.filter((entry) => entry.severity === "error");
    const reviews = violations.filter((entry) => entry.severity === "review");
    for (const entry of [...errors, ...reviews]) {
      console.error(format(entry));
    }
    console.error(
      `check:conventions: ${errors.length} new violation(s), ${reviews.length} review note(s) in ${label}.`,
    );
    if (errors.length > 0) {
      console.error(
        "Fix the change, or record a documented exception in structure.md › Approved exceptions; do not bypass the hook.",
      );
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  }
}
