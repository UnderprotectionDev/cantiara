// biome-ignore-all lint/performance/noAwaitInLoops: Each Pull request is written in order inside one unit of work.

import {
  type GitHubChecksOverview,
  type GitHubObservedCheck,
  type GitHubPullRequestChecksRead,
  type GitHubStoredCheck,
  gitHubChecksInputSchema,
  requirementOf,
  summarizePullRequestChecks,
} from "@cantiara/api/github-checks";
import type {
  GitHubIntegrationStore,
  GitHubIntegrationTransaction,
  GitHubStoredRecord,
} from "@cantiara/api/github-integration";

/**
 * PR check summary behavior (spec 61, story 14). Everything here is a read of
 * GitHub's check facts into this seam's own two tables. The summary shows only
 * the current head SHA of a linked Pull request; a result for an older SHA is
 * kept as superseded and never presented as current. No function here writes
 * a Test Session, Session Test, scenario result, release gate, Work, or
 * GitHub: checks are not tests (specs 54 and 57 are never touched).
 */

type Scope = <T>(
  accountId: string,
  projectId: string,
  mode: "read" | "write",
  work: (transaction: GitHubIntegrationTransaction) => Promise<T>,
) => Promise<T>;

function isLivePullRequest(record: GitHubStoredRecord) {
  return record.kind === "Pull request" && record.lifecycle !== "Trash";
}

function toStored(
  record: GitHubStoredRecord,
  headSha: string,
  check: GitHubObservedCheck,
  observedAt: string,
): GitHubStoredCheck {
  return {
    ...check,
    headSha,
    observedAt,
    projectId: record.projectId,
    recordId: record.id,
    requirement: requirementOf(check.required),
  };
}

/** The head SHA a Pull request payload carried: it supersedes the older head's results. */
export async function observePullHead(
  transaction: GitHubIntegrationTransaction,
  record: GitHubStoredRecord,
  headSha: string,
  now: Date,
) {
  if (!isLivePullRequest(record)) {
    return;
  }
  const current = (await transaction.pullHeads()).find(
    (head) => head.recordId === record.id,
  );
  if (current?.headSha === headSha) {
    return;
  }
  await transaction.setPullHead({
    headSha,
    observedAt: now.toISOString(),
    projectId: record.projectId,
    recordId: record.id,
  });
  await transaction.pruneSupersededChecks(record.id, headSha);
}

/** One reconcile read: the authoritative current head and the checks GitHub shows on it. */
export async function applyCheckReads(
  transaction: GitHubIntegrationTransaction,
  linkId: string,
  reads: GitHubPullRequestChecksRead[],
  now: Date,
) {
  const records = (await transaction.records(linkId)).filter(isLivePullRequest);
  const observedAt = now.toISOString();
  for (const read of reads) {
    const record = records.find((item) => item.number === read.number);
    if (!record) {
      continue;
    }
    await transaction.setPullHead({
      headSha: read.headSha,
      observedAt,
      projectId: record.projectId,
      recordId: record.id,
    });
    await transaction.pruneSupersededChecks(record.id, read.headSha);
    await transaction.upsertChecks(
      read.checks.map((check) =>
        toStored(record, read.headSha, check, observedAt),
      ),
    );
  }
}

/**
 * A `check_run` or `status` webhook. A check run names its Pull requests; a
 * bare commit status is matched to the Pull requests whose current head it is.
 * A result for a SHA that is not the head is stored but not current.
 */
export async function applyCheckEvent(
  transaction: GitHubIntegrationTransaction,
  linkId: string,
  event: {
    check: GitHubObservedCheck;
    headSha: string;
    pullRequestNumbers: number[];
  },
  now: Date,
) {
  const records = (await transaction.records(linkId)).filter(isLivePullRequest);
  const heads = await transaction.pullHeads();
  const targets =
    event.pullRequestNumbers.length > 0
      ? records.filter((record) =>
          event.pullRequestNumbers.includes(record.number),
        )
      : records.filter((record) =>
          heads.some(
            (head) =>
              head.recordId === record.id && head.headSha === event.headSha,
          ),
        );
  for (const record of targets) {
    await transaction.upsertChecks([
      toStored(record, event.headSha, event.check, now.toISOString()),
    ]);
  }
  return targets.length;
}

export function createGitHubChecks(dependencies: {
  scope: Scope;
  store: GitHubIntegrationStore;
}) {
  return {
    async checks(
      accountId: string,
      rawInput: unknown,
    ): Promise<GitHubChecksOverview> {
      const input = gitHubChecksInputSchema.parse(rawInput);
      return await dependencies.scope(
        accountId,
        input.projectId,
        "read",
        async (tx) => {
          const [records, heads, checks] = await Promise.all([
            tx.records(),
            tx.pullHeads(),
            tx.checks(),
          ]);
          const pullRequests = records
            .filter(
              (record) =>
                record.kind === "Pull request" &&
                record.lifecycle === "Active" &&
                record.sourceState === "open",
            )
            .sort((a, b) => a.number - b.number)
            .map((record) =>
              summarizePullRequestChecks({
                checks,
                head: heads.find((head) => head.recordId === record.id) ?? null,
                record,
              }),
            );
          return { pullRequests, readOnly: tx.readOnly };
        },
      );
    },
  };
}
