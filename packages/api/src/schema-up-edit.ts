import { diffLines } from "diff";

/**
 * Guards a hand-edited `Up` text. The text must stay inside the closed
 * operation catalog: schema statements only, no data SQL, no `USING`, no
 * `CASCADE`, no comments and no objects outside the catalog.
 */
export interface UpEditIssue {
  reason: string;
  statement: string;
}

const ALLOWED_STATEMENTS = [
  /^CREATE TABLE \S/,
  /^CREATE (UNIQUE )?INDEX \S/,
  /^CREATE TYPE \S+ AS ENUM \(/,
  /^CREATE DOMAIN \S/,
  /^ALTER TABLE \S+ (ADD COLUMN|DROP COLUMN|RENAME |ALTER COLUMN \S+ (TYPE|SET|DROP)|ADD CONSTRAINT|DROP CONSTRAINT)/,
  /^ALTER TYPE \S+ (ADD VALUE|RENAME VALUE) /,
  /^ALTER DOMAIN \S+ (ADD|DROP) CONSTRAINT /,
  /^DROP (TABLE|INDEX|TYPE|DOMAIN) \S+$/,
];

const DATA_STATEMENT =
  /^(INSERT|UPDATE|DELETE|TRUNCATE|COPY|SELECT|WITH|DO|CALL|EXECUTE|MERGE|VALUES)\b/;
const OUTSIDE_CATALOG =
  /^(CREATE (OR REPLACE )?(MATERIALIZED )?(VIEW|FUNCTION|PROCEDURE|TRIGGER|SEQUENCE|EXTENSION|SCHEMA|ROLE|USER|TABLESPACE|POLICY|RULE|PUBLICATION|SUBSCRIPTION|AGGREGATE|OPERATOR)|ALTER (SEQUENCE|ROLE|USER|SCHEMA|EXTENSION|VIEW|FUNCTION)|GRANT|REVOKE|DROP (VIEW|FUNCTION|SEQUENCE|EXTENSION|SCHEMA|ROLE|TRIGGER))\b/;
const USING_CLAUSE = /\bUSING\b/i;
const CASCADE = /\bCASCADE\b/i;
const DATA_WORDS = /\b(DELETE|UPDATE|INSERT)\b/i;
const INDEX_USING = /\bUSING (btree|hash|gin|gist|brin|spgist)\b/gi;
const ACTION_CLAUSE =
  /\bON (DELETE|UPDATE) (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)\b/gi;
const DANGEROUS_CALL =
  /\b(nextval|setval|pg_\w+|lo_\w+|dblink\w*)\s*\(|\bSELECT\b|\$\$/i;

/** Splits on `;` outside single-quoted strings and double-quoted names. */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (const char of sql) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === ";") {
      statements.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    statements.push(current.trim());
  }
  return statements.filter(Boolean);
}

function outsideQuotes(statement: string): string {
  return statement.replaceAll(/'(?:[^']|'')*'|"(?:[^"]|"")*"/g, "''");
}

function hasComment(sql: string): boolean {
  const bare = outsideQuotes(sql);
  return bare.includes("--") || bare.includes("/*");
}

export function checkUpEdit(sql: string): UpEditIssue[] {
  const issues: UpEditIssue[] = [];
  if (hasComment(sql)) {
    issues.push({
      reason: "Comments can hide statements and are not part of the Up text.",
      statement: sql.slice(0, 80),
    });
  }
  for (const statement of splitStatements(sql)) {
    const flat = statement.replaceAll(/\s+/g, " ");
    const bare = outsideQuotes(flat).replaceAll(ACTION_CLAUSE, "");
    const head = flat.toUpperCase();
    const checks: [boolean, string][] = [
      [
        DATA_STATEMENT.test(head) || DATA_WORDS.test(bare),
        "Data statements, backfills and queries cannot enter the draft.",
      ],
      [
        OUTSIDE_CATALOG.test(head),
        "This object kind is outside the closed operation catalog.",
      ],
      [
        USING_CLAUSE.test(bare.replaceAll(INDEX_USING, "")),
        "A USING expression is data SQL and is not allowed.",
      ],
      [CASCADE.test(bare), "CASCADE is not generated and cannot be added."],
      [
        DANGEROUS_CALL.test(bare),
        "Queries, sequences and system functions cannot enter the draft.",
      ],
      [
        !ALLOWED_STATEMENTS.some((pattern) => pattern.test(flat)),
        "This statement is not in the operation catalog.",
      ],
    ];
    const reason = checks.find(([failed]) => failed)?.[1] ?? null;
    if (reason) {
      issues.push({ reason, statement: flat.slice(0, 120) });
    }
  }
  return issues;
}

export interface UpEditDiff {
  /** True when the edited text differs from the generator output. */
  changed: boolean;
  parts: { kind: "added" | "removed" | "same"; text: string }[];
}

/** Generator output and the user's change, kept apart so edits stay visible. */
function partKind(part: { added?: boolean; removed?: boolean }) {
  if (part.added) {
    return "added" as const;
  }
  return part.removed ? ("removed" as const) : ("same" as const);
}

export function diffUpEdit(generated: string, edited: string): UpEditDiff {
  const parts = diffLines(generated, edited).map((part) => ({
    kind: partKind(part),
    text: part.value,
  }));
  return { changed: generated !== edited, parts };
}
