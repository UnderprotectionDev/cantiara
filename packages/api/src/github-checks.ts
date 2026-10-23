import { z } from "zod";

const identifierSchema = z.string().trim().min(1).max(255);
const timestampSchema = z.string().datetime({ offset: true });

/**
 * PR check summary of the GitHub Integration seam (spec 61, story 14). It is a
 * read-only view of what GitHub reported for the current head SHA of a linked
 * Pull request: it is never a Test Session, Session Test, scenario result or
 * release gate, and nothing here writes to specs 54 or 57.
 */

export const GITHUB_CHECK_REQUIREMENTS = ["Required", "Unknown"] as const;
export type GitHubCheckRequirement = (typeof GITHUB_CHECK_REQUIREMENTS)[number];

export const GITHUB_CHECK_OUTCOMES = [
  "Passed",
  "Failed",
  "Pending",
  "Cancelled",
  "Skipped",
] as const;
export type GitHubCheckOutcome = (typeof GITHUB_CHECK_OUTCOMES)[number];

/** The label a failed check raises on the summary row (`Action needed`). */
export const GITHUB_CHECK_ACTION_LABEL = "Action needed" as const;

/** One check as GitHub reported it for one commit. */
export interface GitHubObservedCheck {
  /** Stable id inside the provider: the check run id or the status context. */
  checkId: string;
  /** GitHub page of the check; the source the rollup and the row open. */
  detailsUrl: string | null;
  name: string;
  outcome: GitHubCheckOutcome;
  /** Provider of the check: the GitHub App slug, or `commit-status`. */
  provider: string;
  /**
   * `true` or `false` only when GitHub said so; `null` otherwise. Requiredness
   * is never inferred from a check name or from branch rules.
   */
  required: boolean | null;
}

/** The open Pull request's current head and the checks GitHub reports on it. */
export interface GitHubPullRequestChecksRead {
  checks: GitHubObservedCheck[];
  headSha: string;
  number: number;
}

export interface GitHubStoredPullHead {
  headSha: string;
  observedAt: string;
  projectId: string;
  recordId: string;
}

export interface GitHubStoredCheck extends GitHubObservedCheck {
  headSha: string;
  observedAt: string;
  projectId: string;
  recordId: string;
  requirement: GitHubCheckRequirement;
}

export function requirementOf(
  required: boolean | null,
): GitHubCheckRequirement {
  return required === true ? "Required" : "Unknown";
}

/** Failed on the current head: the one outcome that raises `Action needed`. */
export function isActionNeeded(check: Pick<GitHubObservedCheck, "outcome">) {
  return check.outcome === "Failed";
}

export function checkKey(
  check: Pick<GitHubObservedCheck, "checkId" | "provider">,
) {
  return `${check.provider}:${check.checkId}`;
}

// ---------------------------------------------------------------------------
// Presentation.
// ---------------------------------------------------------------------------

export const gitHubCheckRowSchema = z
  .object({
    actionNeeded: z.boolean(),
    checkId: z.string(),
    detailsUrl: z.string().nullable(),
    name: z.string(),
    observedAt: timestampSchema,
    outcome: z.enum(GITHUB_CHECK_OUTCOMES),
    provider: z.string(),
    requirement: z.enum(GITHUB_CHECK_REQUIREMENTS),
  })
  .strict();
export type GitHubCheckRow = z.infer<typeof gitHubCheckRowSchema>;

export const gitHubCheckRollupSchema = z
  .object({
    actionNeeded: z.number().int(),
    pending: z.number().int(),
    /** Opens the source checks on GitHub. */
    sourceUrl: z.string(),
    total: z.number().int(),
  })
  .strict();

export const gitHubPullRequestChecksSchema = z
  .object({
    checks: z.array(gitHubCheckRowSchema),
    headSha: z.string().nullable(),
    number: z.number().int(),
    recordId: z.string(),
    rollup: gitHubCheckRollupSchema,
    /** Results kept for an older head SHA: counted, never presented as current. */
    supersededCount: z.number().int(),
    title: z.string(),
  })
  .strict();
export type GitHubPullRequestChecks = z.infer<
  typeof gitHubPullRequestChecksSchema
>;

export const gitHubChecksInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const gitHubChecksOutputSchema = z
  .object({
    pullRequests: z.array(gitHubPullRequestChecksSchema),
    readOnly: z.boolean(),
  })
  .strict();
export type GitHubChecksOverview = z.infer<typeof gitHubChecksOutputSchema>;

/**
 * The summary of one open Pull request: only checks on the current head SHA
 * are current, a check keeps its provider and stable id, and the requirement
 * is `Required` only when GitHub said so.
 */
export function summarizePullRequestChecks(input: {
  checks: GitHubStoredCheck[];
  head: GitHubStoredPullHead | null;
  record: { htmlUrl: string; id: string; number: number; title: string };
}): GitHubPullRequestChecks {
  const own = input.checks.filter(
    (check) => check.recordId === input.record.id,
  );
  const current = input.head
    ? own.filter((check) => check.headSha === input.head?.headSha)
    : [];
  const rows = current
    .map(
      (check): GitHubCheckRow => ({
        actionNeeded: isActionNeeded(check),
        checkId: check.checkId,
        detailsUrl: check.detailsUrl,
        name: check.name,
        observedAt: check.observedAt,
        outcome: check.outcome,
        provider: check.provider,
        requirement: check.requirement,
      }),
    )
    .sort(
      (a, b) =>
        Number(b.actionNeeded) - Number(a.actionNeeded) ||
        a.name.localeCompare(b.name) ||
        a.checkId.localeCompare(b.checkId),
    );
  return {
    checks: rows,
    headSha: input.head?.headSha ?? null,
    number: input.record.number,
    recordId: input.record.id,
    rollup: {
      actionNeeded: rows.filter((row) => row.actionNeeded).length,
      pending: rows.filter((row) => row.outcome === "Pending").length,
      sourceUrl: `${input.record.htmlUrl}/checks`,
      total: rows.length,
    },
    supersededCount: own.length - current.length,
    title: input.record.title,
  };
}

/** Failed checks on the current head of an open Pull request, for `deriveAttentionSignals`. */
export interface GitHubFailedCheck {
  checkId: string;
  headSha: string;
  name: string;
  provider: string;
  recordId: string;
}

export function failedChecksOnCurrentHead(
  heads: GitHubStoredPullHead[],
  checks: GitHubStoredCheck[],
): GitHubFailedCheck[] {
  const headOf = new Map(heads.map((head) => [head.recordId, head.headSha]));
  return checks
    .filter(
      (check) =>
        isActionNeeded(check) && headOf.get(check.recordId) === check.headSha,
    )
    .map((check) => ({
      checkId: check.checkId,
      headSha: check.headSha,
      name: check.name,
      provider: check.provider,
      recordId: check.recordId,
    }));
}
