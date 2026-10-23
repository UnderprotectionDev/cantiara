import { summarizePullRequestChecks } from "@cantiara/api/github-checks";
import type { GitHubIntegrationTransaction } from "@cantiara/api/github-integration";
import {
  derivePrContextCard,
  type GitHubPrContextCard,
  type GitHubPrContextOverview,
  type GitHubReviewer,
  gitHubPrContextInputSchema,
} from "@cantiara/api/github-pr-context";

/**
 * PR Context Card behavior (spec 61, stories 15 and 16). The card is derived
 * live on every read from the Work links of this seam, the owner records
 * behind them (through the `prContextFacts` read port), the stored check
 * summary and, when GitHub supplies them, reviewer states. Nothing is stored
 * and nothing is written: no link, role, Work status, review, approval, merge
 * or GitHub call that changes anything. A missing link is never filled in and
 * the Pull request is never declared ready.
 */

type Scope = <T>(
  accountId: string,
  projectId: string,
  mode: "read" | "write",
  work: (transaction: GitHubIntegrationTransaction) => Promise<T>,
) => Promise<T>;

export interface GitHubReviewerTarget {
  linkId: string;
  number: number;
}

export interface GitHubPrContextDependencies {
  /**
   * Reviewer states GitHub supplies for open Pull requests, by repository link
   * and number. A Pull request GitHub gave no data for is simply absent.
   */
  reviewers: (
    accountId: string,
    projectId: string,
    targets: GitHubReviewerTarget[],
  ) => Promise<Map<string, GitHubReviewer[]>>;
  scope: Scope;
}

export const reviewerKey = (target: GitHubReviewerTarget) =>
  `${target.linkId}#${target.number}`;

export function createGitHubPrContext(
  dependencies: GitHubPrContextDependencies,
) {
  const { scope } = dependencies;

  return {
    async prContext(
      accountId: string,
      rawInput: unknown,
    ): Promise<GitHubPrContextOverview> {
      const input = gitHubPrContextInputSchema.parse(rawInput);
      const read = await scope(
        accountId,
        input.projectId,
        "read",
        async (tx) => {
          const [records, heads, checks, rows, keyScope] = await Promise.all([
            tx.records(),
            tx.pullHeads(),
            tx.checks(),
            tx.workLinks(),
            tx.keyScope(),
          ]);
          const links = rows.filter((row) => !row.removedAt);
          const pulls = records
            .filter(
              (record) =>
                record.kind === "Pull request" &&
                record.lifecycle === "Active" &&
                links.some((link) => link.recordId === record.id),
            )
            .sort((a, b) => a.number - b.number);
          const resolved = new Map(
            links.map((link) => [
              link.id,
              keyScope.works.find(
                (work) =>
                  work.id === link.workId ||
                  work.retiredIds.includes(link.workId),
              ),
            ]),
          );
          const workIds = [
            ...new Set(
              [...resolved.values()].flatMap((work) => (work ? [work.id] : [])),
            ),
          ];
          const facts = await tx.prContextFacts(workIds);
          return {
            checks,
            facts,
            heads,
            links,
            pulls,
            readOnly: tx.readOnly,
            resolved,
          };
        },
      );
      const targets = read.pulls
        .filter((record) => record.sourceState === "open")
        .map((record) => ({ linkId: record.linkId, number: record.number }));
      const reviewers =
        targets.length > 0
          ? await dependencies.reviewers(accountId, input.projectId, targets)
          : new Map<string, GitHubReviewer[]>();
      const cards: GitHubPrContextCard[] = read.pulls.map((record) => {
        const ownLinks = read.links.filter(
          (link) => link.recordId === record.id,
        );
        const works = ownLinks.flatMap((link) => {
          const work = read.resolved.get(link.id);
          return work && !work.trashed ? [work] : [];
        });
        return derivePrContextCard({
          checks: summarizePullRequestChecks({
            checks: read.checks,
            head:
              read.heads.find((head) => head.recordId === record.id) ?? null,
            record,
          }),
          facts: read.facts,
          // A link stored under a retired Work id still reaches the live Work.
          links: ownLinks.map((link) => ({
            ...link,
            workId: read.resolved.get(link.id)?.id ?? link.workId,
          })),
          record,
          reviewers:
            reviewers.get(
              reviewerKey({ linkId: record.linkId, number: record.number }),
            ) ?? [],
          works,
        });
      });
      return { cards, readOnly: read.readOnly };
    },
  };
}
