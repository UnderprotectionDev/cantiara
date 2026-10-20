import { findSecretKinds } from "./test-handoff-package";

/**
 * Fail-closed secret scan of a validated `test-report/1` (spec 54, ticket 05).
 * It reuses the Handoff package patterns (`findSecretKinds`) and sorts what
 * they find into two groups: a KNOWN finding is a provider token or key whose
 * shape is distinctive enough to reject the whole report; an AMBIGUOUS finding
 * is a pattern that can also be harmless text (a credential assignment such as `password: ...`). Only the masked field path is
 * ever returned, never the matched value, and the scan never edits anything.
 */
const KNOWN_KINDS = new Set([
  "private key",
  "GitHub token",
  "API key",
  "AWS access key",
  "Slack token",
  "JSON Web Token",
  "bearer token",
  "URL with credentials",
]);

export interface TestReportSecretFindings {
  /** Masked paths of ambiguous findings, in report order. */
  ambiguous: string[];
  /** Masked paths of known or high-confidence findings, in report order. */
  known: string[];
}

function join(path: string, key: string | number) {
  if (typeof key === "number") {
    return `${path}[${key}]`;
  }
  return path ? `${path}.${key}` : key;
}

/** Walks every string of the report (summary, raw report, context, evidence, notes, titles). */
export function scanTestReportForSecrets(
  report: unknown,
): TestReportSecretFindings {
  const findings: TestReportSecretFindings = { ambiguous: [], known: [] };
  const visit = (value: unknown, path: string) => {
    if (typeof value === "string") {
      const kinds = findSecretKinds(value);
      if (kinds.some((kind) => KNOWN_KINDS.has(kind))) {
        findings.known.push(path);
      } else if (kinds.length > 0) {
        findings.ambiguous.push(path);
      }
    } else if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        visit(item, join(path, index));
      }
    } else if (value !== null && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        visit(item, join(path, key));
      }
    }
  };
  visit(report, "");
  return findings;
}
