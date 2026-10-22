// Reads the mechanically checkable conventions from structure.md and
// docs/tech-stack.md. The documents are the only rule source: a rule that is
// not written there is not enforced, and a section the reader can no longer
// parse fails loudly instead of silently enforcing a stale copy.

export const STRUCTURE_PATH = "structure.md";
export const TECH_STACK_PATH = "docs/tech-stack.md";

export class ConventionRulesError extends Error {
  constructor(source: string, problem: string) {
    super(
      `${source}: ${problem}. Restore the documented shape or update scripts/convention-rules.ts in the same change.`,
    );
    this.name = "ConventionRulesError";
  }
}

export interface FeatureFolder {
  /** Folder relative to the feature, with a trailing slash: `ui/views/`. */
  folder: string;
  jsx: "forbidden" | "required" | undefined;
  namePattern: RegExp | undefined;
  namePatternSource: string | undefined;
  tanstackForm: boolean;
}

export interface ApprovedException {
  /** `<feature>/<folder>/` relative to a features root. */
  path: string;
  reason: string;
}

export interface StructureRules {
  approvedExceptions: ApprovedException[];
  barrelStems: string[];
  forbiddenFeatureNames: string[];
  imports: {
    forbiddenFolders: string[];
    shellExceptFolder: string | undefined;
    shellFeatures: string[];
    webNeverImportsServer: boolean;
  };
  server: { featureRoot: string; folder: string; testsFolder: string };
  testFilePattern: RegExp;
  testsFolder: string;
  web: { featureRoot: string; folders: FeatureFolder[] };
}

export type ControlTarget =
  | { kind: "input"; types: string[] }
  | { kind: "select" }
  | { kind: "textarea" };

export interface ControlRule {
  components: string[];
  target: ControlTarget;
}

export type SubstituteBanId =
  | "console-logging"
  | "raw-clipboard"
  | "raw-fetch"
  | "raw-process-env";

/** A hand-built equivalent the stack row for `tech` rules out. */
export interface SubstituteBan {
  allowedPaths: string[];
  id: SubstituteBanId;
  tech: string;
}

export interface StackRules {
  bans: SubstituteBan[];
  dependencies: {
    approvedNames: string[];
    mentionedTokens: string[];
    rejected: { conditional: boolean; name: string }[];
  };
  forms: {
    controlPackage: string;
    controls: ControlRule[];
    noUseStateFieldState: boolean;
    requireUseForm: boolean;
  };
}

export interface ConventionRules {
  stack: StackRules;
  structure: StructureRules;
}

const KEBAB = "[a-z0-9]+(?:-[a-z0-9]+)*";
const TEXT_INPUT_TYPES = [
  "",
  "text",
  "email",
  "password",
  "search",
  "tel",
  "url",
];

// Turkish purpose words of the TanStack Form row mapped to the raw control
// they replace. A purpose the row names but this table lacks fails loudly.
const CONTROL_PURPOSES: Record<string, ControlTarget> = {
  "çok satır": { kind: "textarea" },
  metin: { kind: "input", types: TEXT_INPUT_TYPES },
  onay: { kind: "input", types: ["checkbox"] },
  seçim: { kind: "select" },
  "tekli seçim": { kind: "input", types: ["radio"] },
};

const BACKTICKED = /`([^`]+)`/g;
const NAME_PATTERN_PARTS = /(<[a-z-]+>|\(x\))/;
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const TREE_BLOCK = /```text\n([\s\S]*?)```/;
const WHITESPACE = /\s+/;
const WEB_ROOT = /^(apps\/web\/src\/features\/)[^/]+\/$/;
const SERVER_ROOT = /^(apps\/server\/src\/features\/)[^/]+\/([^/]+\/)$/;
const TREE_ENTRY = /^(\S+)\s{2,}(.*)$/;
const NAME_TOKEN = /\S*<[a-z-]+>\S*/;
const TRAILING_PUNCTUATION = /[,;:]+$/;
const NO_JSX = /\bno JSX\b/;
const JSX = /\bJSX\b/;
const EXCEPTION_ENTRY = /`([^`]+\/)`(?:\s*\(([^)]*)\))?/g;
const NOT_NAMES = /([^.;]*)\bare not names\b/;
const BARREL = /No `([^`]+)` barrels/g;
const EXTENSION = /\.[^.]+$/;
const FORBIDDEN_IMPORTS = /does not import another feature's ([^.]+)\./;
const SHELL_FEATURES = /shell features (.+?) except their `([^`]+)`/;
const KEBAB_NAME = /^[a-z0-9-]+$/;
const TABLE_SEPARATOR = /^\|\s*-/;
const CONTROLS_CLAUSE = /Kontroller `([^`]+)` bileşenleridir:\s*([^.|]+)/;
const CONTROL_MAPPING =
  /\s*(.+?)\s+için\s+(`[A-Z]\w*`(?:\s+veya\s+`[A-Z]\w*`)*)\s*,?/g;
const PURPOSE_SEPARATOR = /,\s*|\s+ve\s+/;
const LITERAL_PURPOSE = /^`([^`]+)`$/;
const REJECTED_ITEM = /^- \*\*[^*]+:\*\*\s*(.*)$/;
const PARENTHETICAL = /\(([^)]+)\)/g;
const ANY_PARENTHETICAL = /\([^)]*\)/g;
const PLUS_SEPARATOR = /\s\+\s/;
const PACKAGE_LIKE = /^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*(\/[a-z0-9._-]+)*$/;

function backticked(text: string) {
  return [...text.matchAll(BACKTICKED)].map((match) => match[1] ?? "");
}

function section(markdown: string, heading: string, source: string) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) {
    throw new ConventionRulesError(source, `section "## ${heading}" not found`);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n");
}

function namePattern(token: string) {
  let pattern = "";
  for (const part of token.split(NAME_PATTERN_PARTS)) {
    if (part === "(x)") {
      pattern += "x?";
    } else if (part.startsWith("<")) {
      pattern += part === "<file>" ? ".+" : KEBAB;
    } else {
      pattern += part.replace(REGEX_SPECIALS, "\\$&");
    }
  }
  return new RegExp(`^${pattern}$`);
}

interface TreeEntry {
  description: string;
  layer: "other" | "server" | "web";
  nameToken: string | undefined;
  path: string;
}

interface TreeRoots {
  serverFolder?: string;
  serverRoot?: string;
  webRoot?: string;
}

function rootLayer(line: string, roots: TreeRoots): TreeEntry["layer"] {
  const root = line.trim().split(WHITESPACE)[0] ?? "";
  const web = root.match(WEB_ROOT);
  if (web?.[1]) {
    roots.webRoot = web[1];
    return "web";
  }
  const server = root.match(SERVER_ROOT);
  if (server?.[1] && server[2]) {
    roots.serverRoot = server[1];
    roots.serverFolder = server[2];
    return "server";
  }
  return "other";
}

function treeEntries(tree: string, roots: TreeRoots) {
  const entries: TreeEntry[] = [];
  let layer: TreeEntry["layer"] = "other";
  for (const line of tree.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    if (!line.startsWith(" ")) {
      layer = rootLayer(line, roots);
      continue;
    }
    const [, path = "", description = ""] = line.trim().match(TREE_ENTRY) ?? [];
    if (path.endsWith("/")) {
      const nameToken = description
        .match(NAME_TOKEN)?.[0]
        ?.replace(TRAILING_PUNCTUATION, "");
      entries.push({ description, layer, nameToken, path });
    }
  }
  return entries;
}

function featureFolder(entry: TreeEntry): FeatureFolder {
  let jsx: FeatureFolder["jsx"];
  if (NO_JSX.test(entry.description)) {
    jsx = "forbidden";
  } else if (JSX.test(entry.description)) {
    jsx = "required";
  }
  return {
    folder: entry.path,
    jsx,
    namePattern: entry.nameToken ? namePattern(entry.nameToken) : undefined,
    namePatternSource: entry.nameToken,
    tanstackForm: entry.description.includes("TanStack Form"),
  };
}

function readTree(markdown: string) {
  const body = section(markdown, "One feature across layers", STRUCTURE_PATH);
  const tree = body.match(TREE_BLOCK)?.[1];
  if (!tree) {
    throw new ConventionRulesError(
      STRUCTURE_PATH,
      "the ```text feature tree under One feature across layers is missing",
    );
  }
  const roots: TreeRoots = {};
  const entries = treeEntries(tree, roots);
  const web = entries.filter((entry) => entry.layer === "web");
  const webTests = web.find((entry) => entry.path.startsWith("<folder>/"));
  const folders = web.filter((entry) => entry !== webTests).map(featureFolder);
  const serverTests = entries.find(
    (entry) => entry.layer === "server" && entry.path.startsWith("tests"),
  );

  if (!(roots.webRoot && folders.length > 0 && webTests?.nameToken)) {
    throw new ConventionRulesError(
      STRUCTURE_PATH,
      "the feature tree no longer lists apps/web/src/features/<feature>/ folders and <folder>/tests/ with a test name",
    );
  }
  if (!(roots.serverRoot && roots.serverFolder && serverTests)) {
    throw new ConventionRulesError(
      STRUCTURE_PATH,
      "the feature tree no longer lists apps/server/src/features/<feature>/<folder>/ with tests/",
    );
  }
  return {
    server: {
      featureRoot: roots.serverRoot,
      folder: roots.serverFolder,
      testsFolder: serverTests.path,
    },
    testFilePattern: namePattern(webTests.nameToken),
    testsFolder: webTests.path.slice("<folder>/".length),
    web: { featureRoot: roots.webRoot, folders },
  };
}

function rule(rules: string, label: string) {
  const line = rules
    .split("\n")
    .find((candidate) => candidate.startsWith(`- **${label}:**`));
  if (!line) {
    throw new ConventionRulesError(
      STRUCTURE_PATH,
      `rule "- **${label}:**" under Rules not found`,
    );
  }
  return line;
}

function readApprovedExceptions(markdown: string) {
  const body = section(markdown, "Approved exceptions", STRUCTURE_PATH);
  const exceptions: ApprovedException[] = [];
  for (const line of body.split("\n")) {
    if (!line.startsWith("- ")) {
      continue;
    }
    for (const [, path = "", reason] of line.matchAll(EXCEPTION_ENTRY)) {
      if (!reason?.trim()) {
        throw new ConventionRulesError(
          STRUCTURE_PATH,
          `Approved exception \`${path}\` has no reason in parentheses`,
        );
      }
      exceptions.push({ path, reason: reason.trim() });
    }
  }
  return exceptions;
}

function readImports(rules: string): StructureRules["imports"] {
  const imports = rule(rules, "Imports");
  const forbidden = imports.match(FORBIDDEN_IMPORTS)?.[1];
  if (!forbidden) {
    throw new ConventionRulesError(
      STRUCTURE_PATH,
      "the Imports rule no longer says which folders a feature does not import",
    );
  }
  const [, shells, shellExceptFolder] = imports.match(SHELL_FEATURES) ?? [];
  return {
    forbiddenFolders: backticked(forbidden),
    shellExceptFolder,
    shellFeatures: shells
      ? backticked(shells).filter((name) => KEBAB_NAME.test(name))
      : [],
    webNeverImportsServer: imports.includes("never imports server source"),
  };
}

export function readStructureRules(markdown: string): StructureRules {
  const tree = readTree(markdown);
  const rules = section(markdown, "Rules", STRUCTURE_PATH);
  const notNames = rule(rules, "Feature").match(NOT_NAMES)?.[1];
  if (!notNames) {
    throw new ConventionRulesError(
      STRUCTURE_PATH,
      'the Feature rule no longer lists names that "are not names"',
    );
  }
  const barrelStems = [...rule(rules, "Web folders").matchAll(BARREL)].map(
    (match) => (match[1] ?? "").replace(EXTENSION, ""),
  );
  return {
    approvedExceptions: readApprovedExceptions(markdown),
    barrelStems,
    forbiddenFeatureNames: backticked(notNames),
    imports: readImports(rules),
    ...tree,
  };
}

function tableRows(markdown: string) {
  const rows: { cells: string[]; heading: string }[] = [];
  let heading = "";
  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) {
      heading = line.slice(3).trim();
    }
    if (!line.startsWith("|") || TABLE_SEPARATOR.test(line)) {
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells[0] !== "Teknoloji") {
      rows.push({ cells, heading });
    }
  }
  return rows;
}

function controlMapping(subject: string, components: string[]) {
  const controls: ControlRule[] = [];
  const inputTypes: string[] = [];
  for (const purpose of subject.split(PURPOSE_SEPARATOR)) {
    const literal = purpose.match(LITERAL_PURPOSE)?.[1];
    const target = literal ? undefined : CONTROL_PURPOSES[purpose.trim()];
    if (literal) {
      inputTypes.push(literal);
    } else if (!target) {
      throw new ConventionRulesError(
        TECH_STACK_PATH,
        `the TanStack Form row names the control purpose "${purpose.trim()}", which scripts/convention-rules.ts does not map to a raw element`,
      );
    } else if (target.kind === "input") {
      inputTypes.push(...target.types);
    } else {
      controls.push({ components, target });
    }
  }
  if (inputTypes.length > 0) {
    controls.push({ components, target: { kind: "input", types: inputTypes } });
  }
  return controls;
}

function readControls(row: string) {
  const [, controlPackage, clause] = row.match(CONTROLS_CLAUSE) ?? [];
  if (!(controlPackage && clause)) {
    throw new ConventionRulesError(
      TECH_STACK_PATH,
      'the TanStack Form row no longer maps controls after "Kontroller `<package>` bileşenleridir:"',
    );
  }
  const controls = [...clause.matchAll(CONTROL_MAPPING)].flatMap(
    ([, subject = "", componentList = ""]) =>
      controlMapping(subject, backticked(componentList)),
  );
  if (controls.length === 0) {
    throw new ConventionRulesError(
      TECH_STACK_PATH,
      "the TanStack Form row maps no control purpose to a component",
    );
  }
  return { controlPackage, controls };
}

function splitTopLevel(list: string) {
  const items: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of list) {
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
    }
    if (character === "," && depth === 0) {
      items.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  items.push(current);
  return items.map((item) => item.trim()).filter(Boolean);
}

// A ban is enforced only while its stack row still carries the marker phrase;
// removing the sentence from docs/tech-stack.md stops the check.
const SUBSTITUTE_BANS: { id: SubstituteBanId; marker: string; tech: string }[] =
  [
    { id: "raw-fetch", marker: "ham `fetch`", tech: "oRPC" },
    {
      id: "raw-clipboard",
      marker: "`navigator.clipboard`",
      tech: "Browser Clipboard API",
    },
    { id: "console-logging", marker: "`console`", tech: "Evlog" },
    { id: "raw-process-env", marker: "`process.env`", tech: "T3 Env" },
  ];
const SOURCE_PATH = /^[a-z0-9._-]+(\/[a-z0-9._-]+)+\.tsx?$/;

function readBans(rows: { cells: string[] }[]) {
  const bans: SubstituteBan[] = [];
  for (const { id, marker, tech } of SUBSTITUTE_BANS) {
    const text = rows.find((row) => row.cells[0] === tech)?.cells[1];
    if (text?.includes(marker)) {
      bans.push({
        allowedPaths: backticked(text).filter((token) =>
          SOURCE_PATH.test(token),
        ),
        id,
        tech,
      });
    }
  }
  return bans;
}

const REJECTED_HEADING = "Bilinçli olarak eklenmeyenler";
const DEFERRED_HEADING = "Daha sonra eklenecekler";

function readRejected(markdown: string) {
  const body = section(markdown, REJECTED_HEADING, TECH_STACK_PATH);
  return body.split("\n").flatMap((line) => {
    const list = line.match(REJECTED_ITEM)?.[1];
    return list
      ? splitTopLevel(list).map((item) => ({
          conditional: item.includes("("),
          name: item.replace(ANY_PARENTHETICAL, "").replaceAll("`", "").trim(),
        }))
      : [];
  });
}

function technologyNames(cell: string) {
  const alternatives = [...cell.matchAll(PARENTHETICAL)].map(
    (match) => match[1] ?? "",
  );
  return [cell.replace(ANY_PARENTHETICAL, ""), ...alternatives]
    .flatMap((part) => part.split(PLUS_SEPARATOR))
    .map((part) => part.replaceAll("`", "").trim())
    .filter(Boolean);
}

export function readStackRules(markdown: string): StackRules {
  const rows = tableRows(markdown);
  const formText = rows.find((row) => row.cells[0] === "TanStack Form")
    ?.cells[1];
  if (!formText) {
    throw new ConventionRulesError(
      TECH_STACK_PATH,
      'the "| TanStack Form |" table row is missing',
    );
  }
  const deferred = section(markdown, DEFERRED_HEADING, TECH_STACK_PATH);
  return {
    bans: readBans(rows),
    dependencies: {
      approvedNames: rows
        .filter(
          (row) =>
            row.heading !== DEFERRED_HEADING &&
            row.heading !== REJECTED_HEADING,
        )
        .flatMap((row) => technologyNames(row.cells[0] ?? "")),
      mentionedTokens: backticked(markdown.replace(deferred, "")).filter(
        (token) => PACKAGE_LIKE.test(token),
      ),
      rejected: readRejected(markdown),
    },
    forms: {
      ...readControls(formText),
      noUseStateFieldState: formText.includes("ham `useState`"),
      requireUseForm: formText.includes("`useForm`"),
    },
  };
}

export function readConventionRules(
  read: (path: string) => string,
): ConventionRules {
  return {
    stack: readStackRules(read(TECH_STACK_PATH)),
    structure: readStructureRules(read(STRUCTURE_PATH)),
  };
}
