/**
 * Secret class rule of Selected Export (spec 79). Two independent nets run
 * centrally in the seam so no source reader or format producer can bypass them:
 * the key name (session, integration and sharing tokens, link passwords) and
 * obvious credential patterns inside string values. A product identity field
 * that merely looks secret by name (a commit or content hash) is allowlisted
 * explicitly; the allowlist is exact-name only.
 */

/** Key names that mark Secret class data; matched case-insensitively. */
const SECRET_KEY_PATTERN =
  /(password|passphrase|secret|token|apikey|api_key|credential|cookie|authorization|privatekey|private_key|hash|digest|salt)/i;

/**
 * Exact key names that are product identity, not Secret class: the content
 * hash of a File Attachment version and the commit hash of a code reference.
 * Compared case-insensitively with separators removed.
 */
const SAFE_KEY_NAMES: ReadonlySet<string> = new Set([
  "basecommithash",
  "commithash",
  "contenthash",
  "headcommithash",
  "mergecommithash",
]);

const KEY_SEPARATORS = /[_\-\s]/g;
const WHITESPACE = /\s+/;
const HAS_UPPER = /[A-Z]/;
const HAS_LOWER = /[a-z]/;
const HAS_DIGIT = /\d/;

function normalizeKey(key: string): string {
  return key.replace(KEY_SEPARATORS, "").toLowerCase();
}

export function isSecretKey(key: string): boolean {
  if (SAFE_KEY_NAMES.has(normalizeKey(key))) {
    return false;
  }
  return SECRET_KEY_PATTERN.test(key);
}

const CREDENTIAL_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "Bearer token", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/ },
  {
    name: "GitHub token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/,
  },
  { name: "API secret key", pattern: /\bsk[-_][A-Za-z0-9_-]{16,}/ },
  { name: "Slack token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: "JSON Web Token",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/,
  },
  { name: "Private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

const BASE64_WORD = /^[A-Za-z0-9+/_-]{40,}={0,2}$/;

function shannonEntropy(text: string): number {
  const counts = new Map<string, number>();
  for (const character of text) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / text.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

/**
 * A long mixed-case base64 word with letters and digits and high entropy is a
 * token. Hex digests, UUIDs, URLs, paths and prose words never satisfy all of
 * these together, so product identity and ordinary text stay.
 */
function looksLikeOpaqueToken(word: string): boolean {
  return (
    BASE64_WORD.test(word) &&
    HAS_UPPER.test(word) &&
    HAS_LOWER.test(word) &&
    HAS_DIGIT.test(word) &&
    shannonEntropy(word) >= 4.2
  );
}

/** Names the credential class a string value carries, or `null`. */
export function credentialClassOf(value: string): string | null {
  for (const { name, pattern } of CREDENTIAL_PATTERNS) {
    if (pattern.test(value)) {
      return name;
    }
  }
  for (const word of value.split(WHITESPACE)) {
    if (word.length >= 40 && looksLikeOpaqueToken(word)) {
      return "High-entropy token";
    }
  }
  return null;
}

/**
 * Removes Secret class values wherever they sit and records, in `removed`,
 * the removed key names and credential classes (never values). A key-named
 * secret is dropped; a string value carrying a credential becomes `null` (an
 * array item is dropped) so columns keep their shape.
 */
export function stripSecrets<T>(value: T, removed: Set<string>): T {
  if (typeof value === "string") {
    const found = credentialClassOf(value);
    if (found) {
      removed.add(`value: ${found}`);
      return null as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    const kept: unknown[] = [];
    for (const item of value) {
      const stripped = stripSecrets(item, removed);
      if (stripped !== null || item === null) {
        kept.push(stripped);
      }
    }
    return kept as T;
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (isSecretKey(key)) {
        removed.add(key);
        continue;
      }
      output[key] = stripSecrets(item, removed);
    }
    return output as T;
  }
  return value;
}
