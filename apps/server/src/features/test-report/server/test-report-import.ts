import {
  rejection,
  TEST_REPORT_LIMITS,
  type TestReportRejectedError,
} from "@cantiara/api/test-report";
import { isMap, isScalar, parseAllDocuments, visit } from "yaml";

/**
 * Turns a structured file into the value `parseTestReport` validates. JSON is
 * the envelope itself; Markdown holds the same envelope as one YAML 1.2
 * frontmatter document, with the body kept as `raw_report`. The parser only
 * produces plain data: it never decides a field, and the Zod `test-report/1`
 * schema is the only judge of types. Everything unusual fails closed.
 */

const FRONTMATTER =
  /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/;
const BOM = /^\uFEFF/;
const MAX_YAML_NODES = 200_000;
const MAX_YAML_DEPTH = 32;

function refuse(): TestReportRejectedError {
  return rejection("invalid_field");
}

export function parseTestReportJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // The parser message quotes payload text, so it is dropped, not chained.
    // biome-ignore lint/style/useErrorCause: The message quotes payload text and must not be chained.
    throw refuse();
  }
}

/** Exactly one YAML 1.2 document: no alias or anchor, no merge key, no explicit tag, no duplicate key. */
function parseFrontmatterYaml(text: string): unknown {
  const documents = parseAllDocuments(text, {
    merge: false,
    schema: "core",
    uniqueKeys: true,
    version: "1.2",
  });
  const [document] = documents;
  if (
    documents.length !== 1 ||
    !document ||
    document.errors.length > 0 ||
    document.warnings.length > 0
  ) {
    throw refuse();
  }
  let nodes = 0;
  visit(document, {
    Alias: () => {
      throw refuse();
    },
    Node: (_key, node, path) => {
      nodes += 1;
      if (
        node.tag !== undefined ||
        ("anchor" in node && node.anchor !== undefined) ||
        nodes > MAX_YAML_NODES ||
        path.length > MAX_YAML_DEPTH
      ) {
        throw refuse();
      }
    },
    Pair: (_key, pair) => {
      if (isScalar(pair.key) && pair.key.value === "<<") {
        throw refuse();
      }
    },
  });
  const value = document.toJS({ maxAliasCount: 0 });
  if (!isMap(document.contents)) {
    throw refuse();
  }
  return value;
}

export function parseTestReportMarkdown(content: string): unknown {
  const match = FRONTMATTER.exec(content.replace(BOM, ""));
  if (!match) {
    throw refuse();
  }
  const report = parseFrontmatterYaml(match[1] ?? "");
  const body = (match[2] ?? "").trim();
  if (body === "") {
    return report;
  }
  if (typeof report === "object" && report !== null && "raw_report" in report) {
    throw rejection("invalid_field", "raw_report");
  }
  return { ...(report as Record<string, unknown>), raw_report: body };
}

/** Parses a file import by format; the raw size is checked before any parser runs. */
export function parseTestReportFile(
  format: "json" | "markdown",
  content: string,
): unknown {
  if (
    new TextEncoder().encode(content).length > TEST_REPORT_LIMITS.envelopeBytes
  ) {
    throw rejection("payload_too_large");
  }
  return format === "json"
    ? parseTestReportJson(content)
    : parseTestReportMarkdown(content);
}
