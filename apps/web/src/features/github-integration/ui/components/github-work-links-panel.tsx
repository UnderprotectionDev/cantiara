// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the chosen link, signal and the last action message.
import type { GitHubExternalRecord } from "@cantiara/api/github-integration";
import {
  GITHUB_DISMISS_SIGNAL_LABEL,
  GITHUB_UNLINK_WORK_LABEL,
  type GitHubWorkLink,
  type GitHubWorkLinksOverview,
} from "@cantiara/api/github-work-links";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import { errorText } from "../../lib/github-error-text";
import {
  CreateWorkForm,
  type PreviewCreateWork,
  type SubmitCreateWork,
} from "../forms/create-work-form";
import {
  LinkWorkForm,
  type RepositoryChoice,
  type SubmitLinkWork,
} from "../forms/link-work-form";
import { GitHubNotice, type GitHubNoticeState } from "./github-notice";

export interface GitHubWorkLinkActions {
  onCreateWork: SubmitCreateWork;
  onDismissSignal: (signalId: string) => Promise<unknown>;
  onLinkWork: SubmitLinkWork;
  onPreviewCreateWork: PreviewCreateWork;
  onUnlink: (linkId: string) => Promise<unknown>;
}

function originText(link: GitHubWorkLink) {
  return link.origin === "Key match" && link.matchedKey
    ? `Key match ${link.matchedKey}`
    : link.origin;
}

function LinkRow({
  link,
  onUnlink,
}: {
  link: GitHubWorkLink;
  onUnlink: () => void;
}) {
  const nameId = `github-work-link-${link.id}`;
  return (
    <li className="space-y-1 rounded-lg border border-border/70 p-3 text-sm">
      <p id={nameId}>
        <span className="font-medium">{`${link.workKey} ${link.workTitle}`}</span>
        <span className="text-muted-foreground">{` is linked to ${link.kind} `}</span>
        {link.htmlUrl ? (
          <a
            className="underline"
            href={link.htmlUrl}
            rel="noreferrer"
            target="_blank"
          >
            {link.label}
          </a>
        ) : (
          link.label
        )}
      </p>
      <p className="text-muted-foreground">
        {`${link.repository}, ${link.role}, ${originText(link)}`}
        {link.sourceState ? `, ${link.sourceState}` : ""}
      </p>
      <Button
        aria-describedby={nameId}
        onClick={onUnlink}
        type="button"
        variant="outline"
      >
        {GITHUB_UNLINK_WORK_LABEL}
      </Button>
    </li>
  );
}

/**
 * Work links of the Project GitHub area: the links with their role and origin,
 * suggestions that only suggest, the attention signals, and the two ways to
 * link. Linking, unlinking and dismissing write no Work status and nothing on
 * GitHub; this is not an Evidence link and not a usage embed.
 */
export function GitHubWorkLinksPanel({
  actions,
  data,
  records,
  repositories,
}: {
  actions: GitHubWorkLinkActions;
  data: GitHubWorkLinksOverview;
  records: GitHubExternalRecord[];
  repositories: RepositoryChoice[];
}) {
  const [notice, setNotice] = useState<GitHubNoticeState>();
  const run = (done: string, action: () => Promise<unknown>) => {
    setNotice(undefined);
    action().then(
      () => setNotice({ kind: "status", text: done }),
      (caught: unknown) =>
        setNotice({
          kind: "alert",
          text: errorText(caught, "The GitHub action did not finish."),
        }),
    );
  };
  const recordsById = new Map(records.map((record) => [record.id, record]));
  return (
    <section
      aria-labelledby="github-work-links-heading"
      className="space-y-4 text-sm"
    >
      <h3 className="font-medium" id="github-work-links-heading">
        Work links
      </h3>
      <p className="text-muted-foreground">
        A link relates a Work to a GitHub record. It never changes the Work
        status, closes it or edits GitHub.
      </p>
      <GitHubNotice notice={notice} />
      {data.signals.length > 0 ? (
        <section aria-labelledby="github-signals-heading" className="space-y-2">
          <h4 className="font-medium" id="github-signals-heading">
            Attention
          </h4>
          <ul className="space-y-2">
            {data.signals.map((signal) => (
              <li
                className="space-y-1 rounded-lg border border-border/70 p-3"
                key={signal.signalId}
              >
                <p id={`github-signal-${signal.signalId}`}>
                  {signal.summary}{" "}
                  <a
                    className="underline"
                    href={signal.record.htmlUrl}
                    rel="noreferrer"
                    target="_blank"
                  >{`#${signal.record.number} ${signal.record.title}`}</a>
                </p>
                {data.readOnly ? null : (
                  <Button
                    aria-describedby={`github-signal-${signal.signalId}`}
                    onClick={() =>
                      run("Dismissed.", () =>
                        actions.onDismissSignal(signal.signalId),
                      )
                    }
                    type="button"
                    variant="outline"
                  >
                    {GITHUB_DISMISS_SIGNAL_LABEL}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.links.length === 0 ? (
        <p className="text-muted-foreground">No Work is linked to GitHub.</p>
      ) : (
        <ul className="space-y-2">
          {data.links.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              onUnlink={() => run("Unlinked.", () => actions.onUnlink(link.id))}
            />
          ))}
        </ul>
      )}
      {data.suggestions.length > 0 ? (
        <section
          aria-labelledby="github-suggestions-heading"
          className="space-y-2"
        >
          <h4 className="font-medium" id="github-suggestions-heading">
            Suggestions
          </h4>
          <p className="text-muted-foreground">
            These keys did not link on their own. Pick the Work yourself below.
          </p>
          <ul className="list-disc pl-5">
            {data.suggestions.map((suggestion) => {
              const record = recordsById.get(suggestion.recordId);
              return (
                <li key={suggestion.id}>
                  {`${suggestion.key}: ${suggestion.reason}`}
                  {record ? ` (${record.kind} #${record.number})` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {data.readOnly || repositories.length === 0 ? null : (
        <>
          <LinkWorkForm
            onLink={actions.onLinkWork}
            records={records}
            repositories={repositories}
            works={data.works}
          />
          <CreateWorkForm
            onCreate={actions.onCreateWork}
            onPreview={actions.onPreviewCreateWork}
            records={records}
          />
        </>
      )}
    </section>
  );
}
