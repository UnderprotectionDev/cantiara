import {
  GITHUB_OUT_OF_DATE_LABEL,
  type GitHubSyncStatus,
} from "@cantiara/api/github-integration";
import { formatSyncTime } from "../../lib/github-sync-labels";

function SyncTime({ iso }: { iso: string }) {
  return <time dateTime={iso}>{formatSyncTime(iso)}</time>;
}

/**
 * What the founder needs to trust the link: last success, last error, the
 * rate-limit wait and the Out of date mark. Nothing here reads as "working"
 * once a budget is exceeded.
 */
export function GitHubSyncStatusPanel({ sync }: { sync: GitHubSyncStatus }) {
  return (
    <div className="space-y-1">
      {sync.outOfDate ? (
        <p className="font-medium" role="status">
          <span>{GITHUB_OUT_OF_DATE_LABEL}</span>
          <span className="font-normal text-muted-foreground">
            {": the last successful sync is more than 30 minutes old."}
          </span>
        </p>
      ) : null}
      {sync.firstSyncOverdue ? (
        <p role="alert">The first sync did not finish within 30 minutes.</p>
      ) : null}
      <p>
        <span className="text-muted-foreground">Last successful sync: </span>
        {sync.lastSuccessAt ? <SyncTime iso={sync.lastSuccessAt} /> : "Never"}
      </p>
      {sync.lastError ? (
        <p>
          <span className="text-muted-foreground">Last error: </span>
          {sync.lastError}
          {sync.lastErrorAt ? (
            <>
              {" ("}
              <SyncTime iso={sync.lastErrorAt} />
              {")"}
            </>
          ) : null}
        </p>
      ) : null}
      {sync.rateLimitedUntil ? (
        <p>
          <span className="text-muted-foreground">Rate limit: </span>
          {"GitHub asked us to wait until "}
          <SyncTime iso={sync.rateLimitedUntil} />
          {"."}
        </p>
      ) : null}
    </div>
  );
}
