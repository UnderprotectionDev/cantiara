import type { PublishSafetyFinding } from "@cantiara/api/release-communication";

const PLACEHOLDER_PATTERNS = [
  /\blorem ipsum\b/i,
  /\b(?:TODO|TBD|FIXME)\b/,
  /\{\{[^}]*\}\}/,
  /<(?:placeholder|your[ -][a-z ]+|insert[ -][a-z ]+)>/i,
  /\[(?:placeholder|insert[^\]]*|tbd)\]/i,
];

const SENSITIVE_PATTERNS: { label: string; pattern: RegExp }[] = [
  {
    label: "an email address",
    pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  },
  {
    label: "a token-like secret",
    pattern: /\b(?:gh[pousr]_|sk_(?:live|test)_|xox[abp]-)[A-Za-z0-9_-]{8,}/,
  },
  { label: "a bearer credential", pattern: /\bBearer\s+[A-Za-z0-9._-]{16,}/ },
  {
    label: "a private key block",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  },
];

export interface PublishSafetyInput {
  /** Work keys of the project that are outside the approved scope. */
  outOfScopeWorkKeys: string[];
  /** Names of selected records whose fields are not approved; public text must not echo them. */
  privateTerms: string[];
  /** Free text that would become public: the note body and approved snapshot values. */
  texts: { target: string; text: string }[];
}

/**
 * The preview checks of the shared snapshot and external visibility contract
 * (PRD 14): placeholder, sensitive data, closed-world scope and indirect leak.
 */
export function scanPublishSafety(
  input: PublishSafetyInput,
): PublishSafetyFinding[] {
  const findings: PublishSafetyFinding[] = [];
  for (const { target, text } of input.texts) {
    if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text))) {
      findings.push({
        check: "placeholder",
        message: "Replace placeholder text before publishing.",
        target,
      });
    }
    for (const { label, pattern } of SENSITIVE_PATTERNS) {
      if (pattern.test(text)) {
        findings.push({
          check: "sensitive-data",
          message: `This text contains ${label}.`,
          target,
        });
      }
    }
    for (const key of input.outOfScopeWorkKeys) {
      if (
        new RegExp(`(?<![A-Za-z0-9-])${escapeRegExp(key)}(?![0-9])`).test(text)
      ) {
        findings.push({
          check: "closed-world",
          message: `${key} is outside the approved scope.`,
          target,
        });
      }
    }
  }
  for (const { target, text } of input.texts) {
    for (const term of input.privateTerms) {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        findings.push({
          check: "indirect-leak",
          message: `This text echoes "${term}", a record whose fields are not approved.`,
          target,
        });
      }
    }
  }
  return findings;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
