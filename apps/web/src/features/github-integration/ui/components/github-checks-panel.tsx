// biome-ignore-all lint/performance/noJsxPropsBind: Record windows bind identity to the row model for this surface.
import {
  GITHUB_CHECK_ACTION_LABEL,
  type GitHubCheckRow,
  type GitHubChecksOverview,
  type GitHubPullRequestChecks,
} from "@cantiara/api/github-checks";
import {
  VirtualList,
  type VirtualRowProps,
} from "@cantiara/ui/components/virtual-list";

const SHORT_SHA_LENGTH = 7;

function checksCount(count: number) {
  return `${count} ${count === 1 ? "check" : "checks"}`;
}

function CheckRow({
  check,
  rowProps,
}: {
  check: GitHubCheckRow;
  rowProps?: VirtualRowProps;
}) {
  const nameId = `github-check-${check.provider}-${check.checkId}`;
  return (
    <li
      {...rowProps}
      className="space-y-1 rounded-lg border border-border/70 p-3"
    >
      <p id={nameId}>
        {check.detailsUrl ? (
          <a
            className="font-medium underline"
            href={check.detailsUrl}
            rel="noreferrer"
            target="_blank"
          >
            {check.name}
          </a>
        ) : (
          <span className="font-medium">{check.name}</span>
        )}
      </p>
      <p className="text-muted-foreground">
        {`${check.outcome}, ${check.requirement}, ${check.provider} ${check.checkId}`}
        {check.actionNeeded ? (
          <>
            {", "}
            <strong className="text-foreground">
              {GITHUB_CHECK_ACTION_LABEL}
            </strong>
          </>
        ) : null}
      </p>
    </li>
  );
}

function PullRequestChecks({
  pull,
  rowProps,
}: {
  pull: GitHubPullRequestChecks;
  rowProps?: VirtualRowProps;
}) {
  const headingId = `github-checks-pr-${pull.recordId}`;
  return (
    <section {...rowProps} aria-labelledby={headingId} className="space-y-2">
      <h4 className="font-medium" id={headingId}>
        {`Pull request #${pull.number} ${pull.title}`}
      </h4>
      {pull.headSha ? (
        <p className="text-muted-foreground">
          {`Head ${pull.headSha.slice(0, SHORT_SHA_LENGTH)}: ${checksCount(pull.rollup.total)}`}
          {pull.rollup.actionNeeded > 0
            ? `, ${pull.rollup.actionNeeded} ${GITHUB_CHECK_ACTION_LABEL}`
            : ""}
          {pull.rollup.pending > 0 ? `, ${pull.rollup.pending} Pending` : ""}
          {". "}
          <a
            className="underline"
            href={pull.rollup.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            {`Open checks for #${pull.number} on GitHub`}
          </a>
        </p>
      ) : (
        <p className="text-muted-foreground">
          GitHub has not reported a head commit for this Pull request yet.
        </p>
      )}
      {pull.checks.length > 0 ? (
        <VirtualList
          aria-labelledby={headingId}
          className="space-y-2"
          estimateSize={65}
          gap={8}
          getKey={(check) => `${check.provider}:${check.checkId}`}
          rows={pull.checks}
        >
          {(check, checkRowProps) => (
            <CheckRow check={check} rowProps={checkRowProps} />
          )}
        </VirtualList>
      ) : null}
      {pull.supersededCount > 0 ? (
        <p className="text-muted-foreground">
          {`${checksCount(pull.supersededCount)} for an earlier commit ${pull.supersededCount === 1 ? "is" : "are"} not shown as current.`}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Read-only PR check summary of the Project GitHub area. It shows what GitHub
 * reports for the current head commit of each open Pull request and opens the
 * source checks on GitHub. It has no run, re-run or log control and is not a
 * Test Session.
 */
export function GitHubChecksPanel({ data }: { data: GitHubChecksOverview }) {
  if (data.pullRequests.length === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby="github-checks-heading"
      className="space-y-4 text-sm"
    >
      <h3 className="font-medium" id="github-checks-heading">
        Pull request checks
      </h3>
      <p className="text-muted-foreground">
        Read-only from GitHub for the current head commit. Required means GitHub
        says the check is required; otherwise it is Unknown. Checks are not
        tests of this Project.
      </p>
      <VirtualList
        as="div"
        estimateSize={100}
        gap={12}
        getKey={(pull) => pull.recordId}
        rows={data.pullRequests}
      >
        {(pull, rowProps) => (
          <PullRequestChecks pull={pull} rowProps={rowProps} />
        )}
      </VirtualList>
    </section>
  );
}
