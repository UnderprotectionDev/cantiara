import {
  GITHUB_PR_CONTEXT_CARD_LABEL,
  type GitHubPrContextOverview,
  type GitHubPrContextRecord,
  type GitHubPrContextCard as PrContextCard,
} from "@cantiara/api/github-pr-context";
import { AppLink } from "@/components/app-link";
import { projectAreaNavigationHash } from "@/features/project-shell/lib/project-area-navigation";
import {
  projectSourceRecordHash,
  workRecordHash,
} from "@/features/project-shell/lib/project-shell-navigation";

const SHORT_SHA_LENGTH = 7;

/** Where a card row opens: the owner record, never a copy of it. */
export function prContextRecordHref(
  projectId: string,
  record: Pick<GitHubPrContextRecord, "recordId" | "recordType">,
) {
  const base = `/projects/${encodeURIComponent(projectId)}#`;
  if (record.recordType === "Feedback") {
    return `${base}${projectAreaNavigationHash("Discovery")}`;
  }
  return `${base}${projectSourceRecordHash(record.recordType, record.recordId)}`;
}

export function prContextWorkHref(projectId: string, workId: string) {
  return `/projects/${encodeURIComponent(projectId)}#${workRecordHash(workId)}`;
}

function WorkLink({
  projectId,
  work,
}: {
  projectId: string;
  work: { id: string; key: string; title: string };
}) {
  return (
    <AppLink
      className="font-medium underline underline-offset-2"
      href={prContextWorkHref(projectId, work.id)}
    >
      {`${work.key} ${work.title}`}
    </AppLink>
  );
}

function RecordRows({
  label,
  projectId,
  records,
}: {
  label: string;
  projectId: string;
  records: GitHubPrContextRecord[];
}) {
  if (records.length === 0) {
    return null;
  }
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd>
        <ul className="space-y-1">
          {records.map((record) => (
            <li key={record.recordId}>
              <AppLink
                className="underline underline-offset-2"
                href={prContextRecordHref(projectId, record)}
              >
                {record.title}
              </AppLink>
              <span className="text-muted-foreground">
                {`${record.state ? `, ${record.state}` : ""}, via ${record.viaWorkKeys.join(", ")}`}
              </span>
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

function WorkTextRows({
  label,
  projectId,
  rows,
}: {
  label: string;
  projectId: string;
  rows: PrContextCard["problemSources"];
}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd>
        <ul className="space-y-1">
          {rows.map((row) => (
            <li key={row.work.id}>
              {`${row.text} `}
              <span className="text-muted-foreground">
                {"Source: "}
                <WorkLink projectId={projectId} work={row.work} />
              </span>
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

function ChecksRow({ card }: { card: PrContextCard }) {
  const { checks } = card;
  if (!checks.headSha) {
    return null;
  }
  return (
    <div>
      <dt className="font-medium">Checks</dt>
      <dd>
        {`Head ${checks.headSha.slice(0, SHORT_SHA_LENGTH)}: ${checks.rollup.total} ${checks.rollup.total === 1 ? "check" : "checks"}`}
        {checks.rollup.actionNeeded > 0
          ? `, ${checks.rollup.actionNeeded} Action needed`
          : ""}
        {checks.rollup.pending > 0 ? `, ${checks.rollup.pending} Pending` : ""}
        {". "}
        <a
          className="underline underline-offset-2"
          href={checks.rollup.sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          {`Open checks for #${card.number} on GitHub`}
        </a>
      </dd>
    </div>
  );
}

function Card({ card, projectId }: { card: PrContextCard; projectId: string }) {
  const headingId = `github-pr-context-${card.recordId}`;
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-2 rounded-lg border border-border/70 p-3"
    >
      <h4 className="font-medium" id={headingId}>
        {`${GITHUB_PR_CONTEXT_CARD_LABEL}: #${card.number} ${card.title}`}
      </h4>
      <dl className="space-y-2">
        {card.roles.length > 0 ? (
          <div>
            <dt className="font-medium">Linked Work</dt>
            <dd>
              <ul className="space-y-1">
                {card.roles.map((role) => (
                  <li key={role.linkId}>
                    <WorkLink projectId={projectId} work={role.work} />
                    <span className="text-muted-foreground">{`, ${role.role}`}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        <WorkTextRows
          label="Problem source"
          projectId={projectId}
          rows={card.problemSources}
        />
        <WorkTextRows
          label="Expected outcome"
          projectId={projectId}
          rows={card.expectedOutcomes}
        />
        <RecordRows
          label="Decisions"
          projectId={projectId}
          records={card.decisions}
        />
        <RecordRows
          label="Open Risks"
          projectId={projectId}
          records={card.openRisks}
        />
        <RecordRows
          label="Feedback"
          projectId={projectId}
          records={card.feedback}
        />
        <RecordRows
          label="Target release"
          projectId={projectId}
          records={card.targetReleases}
        />
        <ChecksRow card={card} />
        {card.reviewers.length > 0 ? (
          <div>
            <dt className="font-medium">Reviewers</dt>
            <dd>
              <ul className="space-y-1">
                {card.reviewers.map((reviewer) => (
                  <li key={reviewer.login}>
                    {reviewer.reviewUrl ? (
                      <a
                        className="underline underline-offset-2"
                        href={reviewer.reviewUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {reviewer.login}
                      </a>
                    ) : (
                      reviewer.login
                    )}
                    {`: ${reviewer.state}`}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
      <p>
        <a
          className="underline underline-offset-2"
          href={card.htmlUrl}
          rel="noreferrer"
          target="_blank"
        >
          {`Open #${card.number} on GitHub`}
        </a>
      </p>
    </section>
  );
}

/**
 * Read-only `PR Context Card` of each linked Pull request. Every row opens its
 * source record. It has no review, approve, merge or close-Work control, is not
 * a second description or a Work Context Card, and never declares the Pull
 * request ready: diff review, approval and merge stay on GitHub.
 */
export function GitHubPrContextCards({
  data,
  projectId,
}: {
  data: GitHubPrContextOverview;
  projectId: string;
}) {
  if (data.cards.length === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby="github-pr-context-heading"
      className="space-y-3 text-sm"
    >
      <h3 className="font-medium" id="github-pr-context-heading">
        {GITHUB_PR_CONTEXT_CARD_LABEL}
      </h3>
      <p className="text-muted-foreground">
        Read-only and derived from the linked records. Diff review, approval and
        merge stay on GitHub.
      </p>
      {data.cards.map((card) => (
        <Card card={card} key={card.recordId} projectId={projectId} />
      ))}
    </section>
  );
}
