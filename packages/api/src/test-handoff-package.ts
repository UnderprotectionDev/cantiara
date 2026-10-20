/**
 * Test Handoff package contract (spec 53, ticket 04; PRD 10 "Test Handoff
 * paketi sozlesmesi"). A package is the closed context export of ONE Test
 * Handoff record, produced as a Markdown and a JSON rendering of the SAME
 * package version. It is NOT Work's external execution handoff (ADR-0015, spec
 * 24): it shares none of that contract's types and defines the formal test
 * scope. This module is pure (no store, no clock): the server access gathers
 * the source, calls `buildTestHandoffPackage` and persists the result.
 *
 * Key names below are the PRD table, written out one by one. Nothing outside
 * the table is representable: `buildTestHandoffPackage` copies named fields and
 * never spreads a record, so an extra field cannot leak into either rendering.
 */

export const TEST_HANDOFF_PACKAGE_SCHEMA_VERSION =
  "test-handoff-package/1" as const;
/** The only structured return the package names. Acceptance belongs to spec 54. */
export const TEST_REPORT_SCHEMA_VERSION = "test-report/1" as const;

export const TEST_HANDOFF_PACKAGE_KEYS = [
  "schema_version",
  "handoff_id",
  "handoff_package_version",
  "project",
  "title",
  "purpose",
  "created_at",
  "product_build_context",
  "scenarios",
  "ad_hoc_scope",
  "work_context",
  "document_context",
  "environment_preconditions",
  "design_references",
  "return_instructions",
] as const;

export interface TestHandoffPackageSource {
  adHocScope: { expectedBehavior: string; intent: string }[];
  buildContext: {
    branch: string | null;
    build: string | null;
    commit: string | null;
    repository: string | null;
    targetEnvironment: string | null;
  };
  createdAt: string;
  designReferences: {
    screenId: string;
    title: string;
    wireframeVersion: number;
  }[];
  documentContext: {
    documentId: string;
    revision: number;
    sectionId: string | null;
    title: string;
  }[];
  environmentPreconditions: string | null;
  handoffId: string;
  packageVersion: number;
  project: { id: string; name: string };
  purpose: string;
  scenarios: {
    caseId: string;
    expectedBehavior: string;
    notes: string | null;
    preconditions: string;
    purpose: string;
    scope: string;
    title: string;
    version: number;
  }[];
  title: string;
  workContext: { id: string; title: string }[];
}

export interface TestHandoffPackageJson {
  ad_hoc_scope: { expected_behavior: string; intent: string }[];
  created_at: string;
  design_references: {
    kind: "Wireframe";
    screen_id: string;
    title: string;
    version: number;
  }[];
  document_context: {
    document_id: string;
    revision: number;
    section_id: string | null;
    title: string;
  }[];
  environment_preconditions: string | null;
  handoff_id: string;
  handoff_package_version: number;
  product_build_context: Partial<
    Record<
      "branch" | "build" | "commit" | "repository" | "target_environment",
      string
    >
  >;
  project: { id: string; name: string };
  purpose: string;
  return_instructions: {
    accepted_return: typeof TEST_REPORT_SCHEMA_VERSION;
    conditional_result_fields: string[];
    expected_values: {
      handoff_id: string;
      handoff_package_version: number;
      project_id: string;
      schema_version: typeof TEST_REPORT_SCHEMA_VERSION;
    };
    optional_fields: string[];
    required_fields: string[];
    required_result_fields: string[];
  };
  scenarios: {
    expected_behavior: string;
    notes: string | null;
    preconditions: string;
    purpose: string;
    scenario_id: string;
    scenario_version: number;
    scope: string;
    title: string;
  }[];
  schema_version: typeof TEST_HANDOFF_PACKAGE_SCHEMA_VERSION;
  title: string;
  work_context: { id: string; title: string }[];
}

export function buildTestHandoffPackage(
  source: TestHandoffPackageSource,
): TestHandoffPackageJson {
  const context = source.buildContext;
  // Filled fields only: the product never guesses a missing value.
  const productBuildContext: TestHandoffPackageJson["product_build_context"] =
    {};
  if (context.repository) {
    productBuildContext.repository = context.repository;
  }
  if (context.branch) {
    productBuildContext.branch = context.branch;
  }
  if (context.commit) {
    productBuildContext.commit = context.commit;
  }
  if (context.build) {
    productBuildContext.build = context.build;
  }
  if (context.targetEnvironment) {
    productBuildContext.target_environment = context.targetEnvironment;
  }
  return {
    schema_version: TEST_HANDOFF_PACKAGE_SCHEMA_VERSION,
    handoff_id: source.handoffId,
    handoff_package_version: source.packageVersion,
    project: { id: source.project.id, name: source.project.name },
    title: source.title,
    purpose: source.purpose,
    created_at: source.createdAt,
    product_build_context: productBuildContext,
    scenarios: source.scenarios.map((scenario) => ({
      scenario_id: scenario.caseId,
      scenario_version: scenario.version,
      title: scenario.title,
      purpose: scenario.purpose,
      scope: scenario.scope,
      preconditions: scenario.preconditions,
      expected_behavior: scenario.expectedBehavior,
      notes: scenario.notes,
    })),
    ad_hoc_scope: source.adHocScope.map((item) => ({
      intent: item.intent,
      expected_behavior: item.expectedBehavior,
    })),
    work_context: source.workContext.map((item) => ({
      id: item.id,
      title: item.title,
    })),
    document_context: source.documentContext.map((item) => ({
      document_id: item.documentId,
      title: item.title,
      revision: item.revision,
      section_id: item.sectionId,
    })),
    environment_preconditions: source.environmentPreconditions,
    design_references: source.designReferences.map((item) => ({
      kind: "Wireframe",
      screen_id: item.screenId,
      title: item.title,
      version: item.wireframeVersion,
    })),
    return_instructions: {
      accepted_return: TEST_REPORT_SCHEMA_VERSION,
      required_fields: [
        "schema_version",
        "project_id",
        "external_session_id",
        "executor",
        "reported_at",
        "handoff_id",
        "handoff_package_version",
      ],
      required_result_fields: ["external_test_id"],
      conditional_result_fields: ["scenario_id", "scenario_version"],
      optional_fields: [
        "context",
        "summary",
        "raw_report",
        "notes",
        "evidence",
        "relations",
      ],
      expected_values: {
        schema_version: TEST_REPORT_SCHEMA_VERSION,
        project_id: source.project.id,
        handoff_id: source.handoffId,
        handoff_package_version: source.packageVersion,
      },
    },
  };
}

export function renderTestHandoffPackageJson(pkg: TestHandoffPackageJson) {
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

function quoted(text: string) {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

const CONTEXT_MARKDOWN_LABELS = [
  ["repository", "Repository"],
  ["branch", "Branch"],
  ["commit", "Commit"],
  ["build", "Build"],
  ["target_environment", "Target environment"],
] as const;

/**
 * The human rendering of the SAME package object the JSON is made from. It
 * reads only `pkg`, so it can carry no scenario, reference or context the JSON
 * lacks. Free text is block-quoted so a founder's own `#` lines cannot forge a
 * package heading.
 */
export function renderTestHandoffPackageMarkdown(pkg: TestHandoffPackageJson) {
  const lines: string[] = [
    `# ${pkg.title.replace(/\s+/g, " ")}`,
    "",
    `- Schema version: \`${pkg.schema_version}\``,
    `- Handoff id: \`${pkg.handoff_id}\``,
    `- Package version: ${pkg.handoff_package_version}`,
    `- Project: ${pkg.project.name} (\`${pkg.project.id}\`)`,
    `- Created at: ${pkg.created_at}`,
    "",
    "## Purpose and scope",
    "",
    quoted(pkg.purpose),
    "",
    "## Product build context",
    "",
  ];
  const filled = CONTEXT_MARKDOWN_LABELS.filter(
    ([key]) => pkg.product_build_context[key] !== undefined,
  );
  if (filled.length === 0) {
    lines.push("None entered.");
  }
  for (const [key, label] of filled) {
    lines.push(`- ${label}: ${pkg.product_build_context[key]}`);
  }
  lines.push("", "## Scenarios", "");
  if (pkg.scenarios.length === 0) {
    lines.push("None selected.");
  }
  for (const scenario of pkg.scenarios) {
    lines.push(
      `### ${scenario.title.replace(/\s+/g, " ")}`,
      "",
      `- Scenario id: \`${scenario.scenario_id}\``,
      `- Scenario version: ${scenario.scenario_version}`,
      "",
      "Purpose:",
      quoted(scenario.purpose),
      "",
      "Scope:",
      quoted(scenario.scope),
      "",
      "Preconditions:",
      quoted(scenario.preconditions),
      "",
      "Expected behavior:",
      quoted(scenario.expected_behavior),
      "",
    );
    if (scenario.notes !== null) {
      lines.push("Notes:", quoted(scenario.notes), "");
    }
  }
  lines.push("## Ad hoc scope", "");
  if (pkg.ad_hoc_scope.length === 0) {
    lines.push("None.");
  }
  pkg.ad_hoc_scope.forEach((item, index) => {
    lines.push(
      `### Ad hoc item ${index + 1}`,
      "",
      "Intent:",
      quoted(item.intent),
      "",
      "Expected behavior:",
      quoted(item.expected_behavior),
      "",
    );
  });
  lines.push("", "## Work context", "");
  if (pkg.work_context.length === 0) {
    lines.push("None selected.");
  }
  for (const item of pkg.work_context) {
    lines.push(`- ${item.title.replace(/\s+/g, " ")} (\`${item.id}\`)`);
  }
  lines.push("", "## Document context", "");
  if (pkg.document_context.length === 0) {
    lines.push("None selected.");
  }
  for (const item of pkg.document_context) {
    lines.push(
      `- ${item.title.replace(/\s+/g, " ")} (\`${item.document_id}\`), revision ${item.revision}${
        item.section_id ? `, section \`${item.section_id}\`` : ""
      }`,
    );
  }
  lines.push("", "## Environment preconditions", "");
  lines.push(
    pkg.environment_preconditions === null
      ? "None entered."
      : quoted(pkg.environment_preconditions),
  );
  lines.push("", "## Design references", "");
  if (pkg.design_references.length === 0) {
    lines.push("None selected.");
  }
  for (const item of pkg.design_references) {
    lines.push(
      `- ${item.kind}: ${item.title.replace(/\s+/g, " ")} (screen \`${item.screen_id}\`), version ${item.version}`,
    );
  }
  const instructions = pkg.return_instructions;
  lines.push(
    "",
    "## Return instructions",
    "",
    `The only structured return is the \`${instructions.accepted_return}\` report envelope.`,
    "",
    `- Required: ${instructions.required_fields.map((field) => `\`${field}\``).join(", ")}`,
    `- Required per result: ${instructions.required_result_fields.map((field) => `\`${field}\``).join(", ")}`,
    `- Per result when a scenario is applied: ${instructions.conditional_result_fields.map((field) => `\`${field}\``).join(", ")}`,
    `- Optional: ${instructions.optional_fields.map((field) => `\`${field}\``).join(", ")}`,
    `- This package: project \`${instructions.expected_values.project_id}\`, handoff \`${instructions.expected_values.handoff_id}\`, package version ${instructions.expected_values.handoff_package_version}`,
    "",
  );
  return `${lines.join("\n")}\n`;
}

/**
 * Defensive secret scan of founder-typed or copied text. It names the KIND of
 * secret it recognised and never echoes the matched value, so a finding can be
 * shown or logged without repeating the secret.
 */
const SECRET_RULES: readonly { label: string; pattern: RegExp }[] = [
  {
    label: "private key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  },
  {
    label: "GitHub token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/,
  },
  { label: "API key", pattern: /\bsk-[A-Za-z0-9_-]{16,}/ },
  { label: "AWS access key", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { label: "Slack token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  {
    label: "JSON Web Token",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  },
  {
    label: "bearer token",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/i,
  },
  {
    label: "URL with credentials",
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i,
  },
  {
    // A named secret assigned a value that is not a plain word: it needs at
    // least eight characters and a digit or symbol, so "password: incorrect"
    // stays writable but "password: hunter2!x" does not.
    label: "credential assignment",
    pattern:
      /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|token|credential|client[_-]?secret)s?\s*[:=]\s*["']?(?=[^\s"',;]*[0-9_\-!@#$%^&*])[^\s"',;]{8,}/i,
  },
];

export function findSecretKinds(text: string): string[] {
  return SECRET_RULES.filter(({ pattern }) => pattern.test(text)).map(
    ({ label }) => label,
  );
}

export interface TestHandoffPackageSecretFinding {
  kind: string;
  /** Path of the offending value inside the package, e.g. `scenarios[0].scope`. */
  path: string;
}

/** Walks every string of the package; the path is reported, the value never. */
export function scanTestHandoffPackageForSecrets(
  pkg: unknown,
): TestHandoffPackageSecretFinding[] {
  const findings: TestHandoffPackageSecretFinding[] = [];
  const visit = (value: unknown, path: string) => {
    if (typeof value === "string") {
      for (const kind of findSecretKinds(value)) {
        findings.push({ kind, path });
      }
    } else if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        visit(item, `${path}[${index}]`);
      }
    } else if (value !== null && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        visit(item, path ? `${path}.${key}` : key);
      }
    }
  };
  visit(pkg, "");
  return findings;
}
