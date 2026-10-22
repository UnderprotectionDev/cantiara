// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the chosen link and the last action message.
import {
  GITHUB_APP_LABEL,
  GITHUB_AREA_LABEL,
  GITHUB_CONTENTS_REASON_LABEL,
  GITHUB_DISCONNECT_LABEL,
  GITHUB_INSTALL_LABEL,
  GITHUB_PERMISSIONS_LABEL,
  GITHUB_RECONNECT_LABEL,
  GITHUB_REPOSITORY_LABEL,
  GITHUB_SKIP_TRIAGE_LABEL,
  GITHUB_SYNC_NOW_LABEL,
  GITHUB_TRIAGE_LABEL,
  type GitHubExternalRecord,
  type GitHubLinkPreview,
  type GitHubOverview,
  type GitHubRepositoryLink,
  type GitHubTriagePreview,
} from "@cantiara/api/github-integration";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { linkActionsFor, syncNowMessage } from "../../lib/github-sync-labels";
import { GitHubLinkPreviewPanel } from "../components/github-link-preview";
import { GitHubSyncStatusPanel } from "../components/github-sync-status";
import {
  LinkRepositoryForm,
  type LoadRepositories,
  type SubmitLinkRepository,
} from "../forms/link-repository-form";
import { SearchGitHubRecordsForm } from "../forms/search-github-records-form";

export interface GitHubIntegrationActions {
  loadPreview: (
    action: GitHubLinkPreview["action"],
    linkId: string,
  ) => Promise<GitHubLinkPreview>;
  loadRepositories: LoadRepositories;
  loadTriage: (linkId: string) => Promise<GitHubTriagePreview>;
  onDisconnect: (linkId: string) => Promise<unknown>;
  onLink: SubmitLinkRepository;
  onReconnect: (linkId: string) => Promise<unknown>;
  onSearch: (query: string) => Promise<GitHubExternalRecord[]>;
  onSkipTriage: (linkId: string) => Promise<unknown>;
  onStartInstall: () => Promise<unknown>;
  onSyncNow: (linkId: string) => Promise<{
    applied: number;
    outcome: "disconnected" | "failed" | "paused" | "ran" | "rate-limited";
    restoredDiffs: {
      from: { title: string };
      to: { title: string };
    }[];
    stale: number;
  }>;
}

type Notice = { kind: "alert" | "status"; text: string } | undefined;

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function PermissionsPanel({ app }: { app: GitHubOverview["app"] }) {
  return (
    <section
      aria-labelledby="github-permissions-heading"
      className="space-y-2 rounded-lg border border-border/70 p-4 text-sm"
    >
      <h3 className="font-medium" id="github-permissions-heading">
        {GITHUB_PERMISSIONS_LABEL}
      </h3>
      <ul className="list-disc pl-5">
        {app.permissions.map(({ access, permission }) => (
          <li key={permission}>{`${permission}: ${access}`}</li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        The GitHub App never asks for a write permission.
      </p>
      <h4 className="font-medium">{GITHUB_CONTENTS_REASON_LABEL}</h4>
      <p>{app.contentsReason}</p>
    </section>
  );
}

function TriagePanel({
  link,
  loadTriage,
  onSkip,
}: {
  link: GitHubRepositoryLink;
  loadTriage: GitHubIntegrationActions["loadTriage"];
  onSkip: () => void;
}) {
  const [open, setOpen] = useState(false);
  const preview = useQuery({
    enabled: open,
    gcTime: 0,
    queryFn: () => loadTriage(link.id),
    queryKey: ["github-triage", link.id],
  });
  const headingId = `github-triage-${link.id}`;
  if (link.triage === "Skipped") {
    return (
      <p className="text-muted-foreground text-sm">
        Triage skipped. Its Issues stay searchable as GitHub records.
      </p>
    );
  }
  return (
    <section aria-labelledby={headingId} className="space-y-2 text-sm">
      <h4 className="font-medium" id={headingId}>
        {GITHUB_TRIAGE_LABEL}
      </h4>
      <p className="text-muted-foreground">
        Group the Issues GitHub already has. Nothing here becomes Work, gets a
        status or lands on a planning surface.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          type="button"
          variant="outline"
        >
          {open ? "Hide triage preview" : "Show triage preview"}
        </Button>
        <Button onClick={onSkip} type="button" variant="outline">
          {GITHUB_SKIP_TRIAGE_LABEL}
        </Button>
      </div>
      {open && preview.isPending ? (
        <p role="status">Loading triage preview…</p>
      ) : null}
      {open && preview.isError ? (
        <p className="text-destructive" role="alert">
          The triage preview is unavailable.
        </p>
      ) : null}
      {open && preview.data ? (
        <div className="space-y-3">
          {preview.data.groups.length === 0 ? (
            <p className="text-muted-foreground">No Issues to triage.</p>
          ) : null}
          {preview.data.groups.map((group) => (
            <section aria-label={group.label} key={group.key}>
              <h5 className="font-medium">{`${group.label} (${group.records.length})`}</h5>
              <ul className="list-disc pl-5">
                {group.records.map((record) => (
                  <li key={record.id}>
                    <a
                      className="underline"
                      href={record.htmlUrl}
                      rel="noreferrer"
                      target="_blank"
                    >{`#${record.number} ${record.title}`}</a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function LinkItem({
  actions,
  link,
  run,
}: {
  actions: GitHubIntegrationActions;
  link: GitHubRepositoryLink;
  run: <T>(
    done: string | ((result: T) => string),
    action: () => Promise<T>,
  ) => void;
}) {
  const nameId = `github-link-${link.id}`;
  const available = linkActionsFor(link.connection);
  const [pending, setPending] = useState<GitHubLinkPreview["action"]>();
  const preview = useQuery({
    enabled: pending !== undefined,
    gcTime: 0,
    queryFn: () => actions.loadPreview(pending ?? "Reconnect", link.id),
    queryKey: ["github-link-preview", link.id, pending],
  });
  const confirm = () => {
    const action = pending;
    setPending(undefined);
    if (action === "Disconnect") {
      run("Disconnected.", () => actions.onDisconnect(link.id));
    } else if (action === "Reconnect") {
      run("Reconnected.", () => actions.onReconnect(link.id));
    }
  };
  return (
    <li className="space-y-2 rounded-lg border border-border/70 p-4 text-sm">
      <h4 className="font-medium" id={nameId}>
        <a
          className="underline"
          href={link.htmlUrl}
          rel="noreferrer"
          target="_blank"
        >{`${link.owner}/${link.name}`}</a>
      </h4>
      <p>
        <span className="text-muted-foreground">Status: </span>
        {link.connection}
        {link.stopReason ? `, ${link.stopReason}` : ""}
        {link.pauseReason ? `, ${link.pauseReason}` : ""}
      </p>
      <GitHubSyncStatusPanel sync={link.sync} />
      {link.previousNames.length > 0 ? (
        <p className="text-muted-foreground">
          {`Formerly ${link.previousNames
            .map((entry) => `${entry.owner}/${entry.name}`)
            .join(", ")}`}
        </p>
      ) : null}
      <p className="text-muted-foreground">
        {`${GITHUB_APP_LABEL} account ${link.accountLogin}, ${link.externalRecordCount} GitHub records kept`}
      </p>
      <div className="flex flex-wrap gap-2">
        {available.canSyncNow ? (
          <Button
            aria-describedby={nameId}
            onClick={() =>
              run(
                (result: Awaited<ReturnType<typeof actions.onSyncNow>>) =>
                  [
                    syncNowMessage(result),
                    ...result.restoredDiffs.map(
                      ({ from, to }) => `${from.title} became ${to.title}.`,
                    ),
                  ].join(" "),
                () => actions.onSyncNow(link.id),
              )
            }
            type="button"
            variant="outline"
          >
            {GITHUB_SYNC_NOW_LABEL}
          </Button>
        ) : null}
        {available.canReconnect ? (
          <Button
            aria-describedby={nameId}
            aria-expanded={pending === "Reconnect"}
            onClick={() => setPending("Reconnect")}
            type="button"
          >
            {GITHUB_RECONNECT_LABEL}
          </Button>
        ) : null}
        {available.canDisconnect ? (
          <Button
            aria-describedby={nameId}
            aria-expanded={pending === "Disconnect"}
            onClick={() => setPending("Disconnect")}
            type="button"
            variant="outline"
          >
            {GITHUB_DISCONNECT_LABEL}
          </Button>
        ) : null}
      </div>
      {pending ? (
        <GitHubLinkPreviewPanel
          action={pending}
          error={preview.isError}
          linkId={link.id}
          onCancel={() => setPending(undefined)}
          onConfirm={confirm}
          preview={preview.data}
        />
      ) : null}
      <TriagePanel
        link={link}
        loadTriage={actions.loadTriage}
        onSkip={() =>
          run("Triage skipped.", () => actions.onSkipTriage(link.id))
        }
      />
    </li>
  );
}

function RecordSearch({
  onSearch,
}: {
  onSearch: GitHubIntegrationActions["onSearch"];
}) {
  const [search, setSearch] = useState({ submitted: false, text: "" });
  const results = useQuery({
    enabled: search.submitted,
    gcTime: 0,
    queryFn: () => onSearch(search.text),
    queryKey: ["github-record-search", search.text],
  });
  return (
    <section
      aria-labelledby="github-records-heading"
      className="space-y-3 text-sm"
    >
      <h3 className="font-medium" id="github-records-heading">
        GitHub records
      </h3>
      <SearchGitHubRecordsForm
        onSearch={(text) => setSearch({ submitted: true, text })}
      />
      {results.isError ? (
        <p className="text-destructive" role="alert">
          GitHub records are unavailable.
        </p>
      ) : null}
      {results.data ? (
        <div aria-live="polite">
          <p className="text-muted-foreground">{`${results.data.length} GitHub records`}</p>
          <ul className="space-y-1">
            {results.data.map((record) => (
              <li key={record.id}>
                <a
                  className="underline"
                  href={record.htmlUrl}
                  rel="noreferrer"
                  target="_blank"
                >{`${record.kind} #${record.number} ${record.title}`}</a>
                <span className="text-muted-foreground">{`, ${record.sourceState}`}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The Project GitHub area: install the GitHub App, link Repositories by stable
 * id, read the permission set and the reason for Contents, skip or preview the
 * first triage, Reconnect or Disconnect. It writes no Work and never shows a
 * login or session control.
 */
export function GitHubIntegrationView({
  actions,
  overview,
}: {
  actions: GitHubIntegrationActions;
  overview: GitHubOverview;
}) {
  const [notice, setNotice] = useState<Notice>();
  const run = <T,>(
    done: string | ((result: T) => string),
    action: () => Promise<T>,
  ) => {
    setNotice(undefined);
    action().then(
      (result) =>
        setNotice({
          kind: "status",
          text: typeof done === "string" ? done : done(result),
        }),
      (caught: unknown) =>
        setNotice({
          kind: "alert",
          text: errorText(caught, "The GitHub action did not finish."),
        }),
    );
  };
  const { app, installations, links, readOnly } = overview;
  return (
    <section aria-labelledby="github-heading" className="space-y-5">
      <h2 className="font-semibold text-lg" id="github-heading">
        {GITHUB_AREA_LABEL}
      </h2>
      <p className="text-muted-foreground text-sm">
        {`The ${GITHUB_APP_LABEL} installation, not your GitHub login, gives this Project read-only access to the ${GITHUB_REPOSITORY_LABEL} you select. Removing either one leaves the other alone.`}
      </p>
      <div aria-live="polite" role="status">
        {notice?.kind === "status" ? notice.text : null}
      </div>
      {notice?.kind === "alert" ? (
        <p className="text-destructive text-sm" role="alert">
          {notice.text}
        </p>
      ) : null}
      {app.configured ? null : (
        <p className="text-sm" role="alert">
          {`The ${GITHUB_APP_LABEL} is not configured on this server.`}
        </p>
      )}
      {readOnly ? (
        <p className="text-muted-foreground text-sm">
          This Project is archived, so its GitHub link is paused.
        </p>
      ) : null}
      <PermissionsPanel app={app} />
      <div className="space-y-2">
        <Button
          disabled={!app.configured || readOnly}
          onClick={() => run("Opening GitHub…", () => actions.onStartInstall())}
          type="button"
        >
          {GITHUB_INSTALL_LABEL}
        </Button>
        {installations.length > 0 ? (
          <ul className="text-muted-foreground text-sm">
            {installations.map((installation) => (
              <li key={installation.id}>
                {`${GITHUB_APP_LABEL} on ${installation.accountLogin}`}
                {installation.removedAt ? ", uninstalled" : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {readOnly ? null : (
        <LinkRepositoryForm
          installations={installations}
          loadRepositories={actions.loadRepositories}
          onLink={actions.onLink}
        />
      )}
      <section aria-labelledby="github-links-heading" className="space-y-3">
        <h3 className="font-medium" id="github-links-heading">
          {`${GITHUB_REPOSITORY_LABEL} links`}
        </h3>
        {links.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {`No ${GITHUB_REPOSITORY_LABEL} is linked yet. A Project works without one.`}
          </p>
        ) : (
          <ul className="space-y-3">
            {links.map((link) => (
              <LinkItem actions={actions} key={link.id} link={link} run={run} />
            ))}
          </ul>
        )}
      </section>
      {links.length > 0 ? <RecordSearch onSearch={actions.onSearch} /> : null}
    </section>
  );
}
