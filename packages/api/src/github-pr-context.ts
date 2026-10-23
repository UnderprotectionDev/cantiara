import { z } from "zod";

import {
  type GitHubPullRequestChecks,
  gitHubPullRequestChecksSchema,
} from "./github-checks";
import {
  GITHUB_WORK_LINK_ROLES,
  type GitHubStoredWorkLink,
} from "./github-work-links";

/**
 * PR Context Card of the GitHub Integration seam (spec 61, stories 15 and 16).
 *
 * The card is a live, read-only view derived from owner records: the linked
 * Work (problem source, expected outcome), the Karar, open Risk, Feedback and
 * target Proje Surumu that Work relates to, the link role, the current head SHA
 * check summary and, only when GitHub supplies them, compact reviewer states.
 * Every row names the source record it opens. The card stores nothing, writes
 * nothing, is not a second description, a Work Context Card (spec 16), an
 * in-context preview editor, a test summary (57) or an evidence package (64),
 * and it never fills a missing link or declares the Pull request ready.
 */

const identifierSchema = z.string().trim().min(1).max(255);

export const GITHUB_PR_CONTEXT_CARD_LABEL = "PR Context Card" as const;

/** Compact reviewer states (PRD 12). GitHub supplies them; nothing infers them. */
export const GITHUB_REVIEWER_STATES = [
  "Pending",
  "Approved",
  "Changes requested",
  "Commented",
] as const;
export type GitHubReviewerState = (typeof GITHUB_REVIEWER_STATES)[number];

/** Record types the card opens besides the linked Work and GitHub itself. */
export const GITHUB_PR_CONTEXT_RECORD_TYPES = [
  "Decision",
  "Risk",
  "Feedback",
  "Project Release",
] as const;
export type GitHubPrContextRecordType =
  (typeof GITHUB_PR_CONTEXT_RECORD_TYPES)[number];

// ---------------------------------------------------------------------------
// Reviewer states from what GitHub reported (pure).
// ---------------------------------------------------------------------------

export interface GitHubRawReview {
  login: string;
  /** GitHub review state: APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED, PENDING. */
  state: string;
  submittedAt: string | null;
  url: string | null;
}

export interface GitHubReviewerRead {
  /** Users or teams GitHub still waits on (requested reviewers). */
  requested: string[];
  reviews: GitHubRawReview[];
}

export const gitHubReviewerSchema = z
  .object({
    /** GitHub page of the review when GitHub gave one. */
    reviewUrl: z.string().nullable(),
    login: z.string(),
    state: z.enum(GITHUB_REVIEWER_STATES),
  })
  .strict();
export type GitHubReviewer = z.infer<typeof gitHubReviewerSchema>;

/**
 * A requested reviewer is `Pending`; otherwise the latest decisive review
 * (`Approved` or `Changes requested`) wins over plain comments; a reviewer who
 * only commented is `Commented`. Dismissed and draft reviews say nothing.
 */
export function deriveReviewerStates(read: GitHubReviewerRead) {
  const byLogin = new Map<string, GitHubRawReview[]>();
  for (const review of read.reviews) {
    if (review.state === "DISMISSED" || review.state === "PENDING") {
      continue;
    }
    byLogin.set(review.login, [...(byLogin.get(review.login) ?? []), review]);
  }
  const rows = new Map<string, GitHubReviewer>();
  for (const [login, reviews] of byLogin) {
    const ordered = [...reviews].sort((a, b) =>
      (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""),
    );
    const decisive = ordered
      .filter(
        (review) =>
          review.state === "APPROVED" || review.state === "CHANGES_REQUESTED",
      )
      .at(-1);
    const latest = decisive ?? ordered.at(-1);
    if (!latest) {
      continue;
    }
    let state: GitHubReviewerState | null = null;
    if (latest.state === "APPROVED") {
      state = "Approved";
    } else if (latest.state === "CHANGES_REQUESTED") {
      state = "Changes requested";
    } else if (latest.state === "COMMENTED") {
      state = "Commented";
    }
    if (state) {
      rows.set(login, { login, reviewUrl: latest.url, state });
    }
  }
  for (const login of read.requested) {
    rows.set(login, { login, reviewUrl: null, state: "Pending" });
  }
  return [...rows.values()].sort((a, b) => a.login.localeCompare(b.login));
}

// ---------------------------------------------------------------------------
// Owner-record facts (a read-only port; the owners keep their records).
// ---------------------------------------------------------------------------

export interface GitHubPrContextRecordFact {
  recordId: string;
  recordType: GitHubPrContextRecordType;
  /** Owner state text (`Valid`, `Open`, a Release status); never edited here. */
  state: string | null;
  title: string;
}

export interface GitHubPrContextWorkFacts {
  expectedOutcome: string | null;
  problemOpportunity: string | null;
  records: GitHubPrContextRecordFact[];
  workId: string;
}

/** A Risk is open until the Risk owner resolves or accepts it. */
export function isOpenRisk(state: string | null) {
  return state !== "Resolved" && state !== "Accepted";
}

// ---------------------------------------------------------------------------
// Presentation.
// ---------------------------------------------------------------------------

const sourceWorkSchema = z
  .object({ id: z.string(), key: z.string(), title: z.string() })
  .strict();

export const gitHubPrContextRoleSchema = z
  .object({
    linkId: z.string(),
    role: z.enum(GITHUB_WORK_LINK_ROLES),
    work: sourceWorkSchema,
  })
  .strict();

/** The text a Work holds in its own field: shown as stored, opens that Work. */
export const gitHubPrContextWorkTextSchema = z
  .object({ text: z.string(), work: sourceWorkSchema })
  .strict();

export const gitHubPrContextRecordSchema = z
  .object({
    recordId: z.string(),
    recordType: z.enum(GITHUB_PR_CONTEXT_RECORD_TYPES),
    state: z.string().nullable(),
    title: z.string(),
    /** Keys of the linked Work this record is related to. */
    viaWorkKeys: z.array(z.string()),
  })
  .strict();
export type GitHubPrContextRecord = z.infer<typeof gitHubPrContextRecordSchema>;

export const gitHubPrContextCardSchema = z
  .object({
    /** Karar records related to a linked Work. */
    decisions: z.array(gitHubPrContextRecordSchema),
    expectedOutcomes: z.array(gitHubPrContextWorkTextSchema),
    feedback: z.array(gitHubPrContextRecordSchema),
    htmlUrl: z.string(),
    number: z.number().int(),
    openRisks: z.array(gitHubPrContextRecordSchema),
    problemSources: z.array(gitHubPrContextWorkTextSchema),
    recordId: z.string(),
    /** Present only when GitHub supplied reviewer data. */
    reviewers: z.array(gitHubReviewerSchema),
    roles: z.array(gitHubPrContextRoleSchema),
    sourceState: z.enum(["open", "closed", "merged"]),
    targetReleases: z.array(gitHubPrContextRecordSchema),
    title: z.string(),
    checks: gitHubPullRequestChecksSchema,
  })
  .strict();
export type GitHubPrContextCard = z.infer<typeof gitHubPrContextCardSchema>;

export const gitHubPrContextInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const gitHubPrContextOutputSchema = z
  .object({
    cards: z.array(gitHubPrContextCardSchema),
    readOnly: z.boolean(),
  })
  .strict();
export type GitHubPrContextOverview = z.infer<
  typeof gitHubPrContextOutputSchema
>;

/**
 * Pure derivation of one card. Only the Work links the founder or a unique key
 * made are read; nothing here adds a link, a role or a status.
 */
export function derivePrContextCard(input: {
  checks: GitHubPullRequestChecks;
  facts: GitHubPrContextWorkFacts[];
  links: GitHubStoredWorkLink[];
  record: {
    htmlUrl: string;
    id: string;
    number: number;
    sourceState: "open" | "closed" | "merged";
    title: string;
  };
  reviewers: GitHubReviewer[];
  works: { id: string; key: string; title: string }[];
}): GitHubPrContextCard {
  const linked = new Map<
    string,
    { link: GitHubStoredWorkLink; work: (typeof input.works)[number] }
  >();
  for (const link of input.links) {
    const work = input.works.find((item) => item.id === link.workId);
    if (work && !linked.has(link.id)) {
      linked.set(link.id, { link, work });
    }
  }
  const roles = [...linked.values()]
    .map(({ link, work }) => ({
      linkId: link.id,
      role: link.role,
      work: { id: work.id, key: work.key, title: work.title },
    }))
    .sort((a, b) => a.work.key.localeCompare(b.work.key));
  const factOf = (workId: string) =>
    input.facts.find((fact) => fact.workId === workId);
  const textRows = (pick: (fact: GitHubPrContextWorkFacts) => string | null) =>
    roles.flatMap((role) => {
      const text = pick(factOf(role.work.id) ?? emptyFacts(role.work.id));
      return text?.trim() ? [{ text, work: role.work }] : [];
    });
  const recordRows = (
    type: GitHubPrContextRecordType,
    keep: (fact: GitHubPrContextRecordFact) => boolean,
  ) => {
    const byRecord = new Map<string, GitHubPrContextRecord>();
    for (const role of roles) {
      for (const fact of factOf(role.work.id)?.records ?? []) {
        if (fact.recordType !== type || !keep(fact)) {
          continue;
        }
        addVia(byRecord, fact, role.work.key);
      }
    }
    return [...byRecord.values()].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
  };
  return {
    checks: input.checks,
    decisions: recordRows("Decision", () => true),
    expectedOutcomes: textRows((fact) => fact.expectedOutcome),
    feedback: recordRows("Feedback", () => true),
    htmlUrl: input.record.htmlUrl,
    number: input.record.number,
    openRisks: recordRows("Risk", (fact) => isOpenRisk(fact.state)),
    problemSources: textRows((fact) => fact.problemOpportunity),
    recordId: input.record.id,
    reviewers: input.reviewers,
    roles,
    sourceState: input.record.sourceState,
    targetReleases: recordRows("Project Release", () => true),
    title: input.record.title,
  };
}

function addVia(
  byRecord: Map<string, GitHubPrContextRecord>,
  fact: GitHubPrContextRecordFact,
  workKey: string,
) {
  const existing = byRecord.get(fact.recordId);
  if (!existing) {
    byRecord.set(fact.recordId, {
      recordId: fact.recordId,
      recordType: fact.recordType,
      state: fact.state,
      title: fact.title,
      viaWorkKeys: [workKey],
    });
  } else if (!existing.viaWorkKeys.includes(workKey)) {
    existing.viaWorkKeys.push(workKey);
  }
}

function emptyFacts(workId: string): GitHubPrContextWorkFacts {
  return {
    expectedOutcome: null,
    problemOpportunity: null,
    records: [],
    workId,
  };
}
