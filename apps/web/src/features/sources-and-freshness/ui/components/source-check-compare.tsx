import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { VersionPinnedEvidence } from "@cantiara/api/evidence";
import { findSourceEvidenceMatch } from "@cantiara/api/source-evidence";
import type { SourceCheck } from "@cantiara/api/source-recheck";
import type { SourceVersion } from "@cantiara/api/sources-and-freshness";
import { diffLines } from "diff";
import { formatAccountDateTime } from "../../../account-preferences/lib/account-preferences-format";

function partLabel(part: { added?: boolean; removed?: boolean }) {
  if (part.added) {
    return "Added: ";
  }
  if (part.removed) {
    return "Removed: ";
  }
  return "Unchanged: ";
}

export function SourceCheckCompare({
  check,
  version,
  preferences,
  pins = [],
}: {
  check: SourceCheck;
  version: SourceVersion;
  preferences: AccountPreferences;
  pins?: VersionPinnedEvidence[];
}) {
  const parts = check.candidate
    ? diffLines(version.capturedContent, check.candidate.capturedContent, {
        timeout: 1000,
        maxEditLength: 2000,
      })
    : undefined;
  return (
    <fieldset
      aria-label="Source Check"
      className="space-y-3 rounded-lg border p-4"
    >
      <h4 className="font-medium">Source Check</h4>
      <p>
        {formatAccountDateTime(check.checkedAt, preferences)} · User initiated
      </p>
      <p className="break-all">
        {check.startUrl} → {check.fetchResult?.finalUrl ?? "No response"}
      </p>
      <p>
        HTTP {check.fetchResult?.httpStatus ?? "unavailable"} ·{" "}
        {check.fetchResult?.contentType ?? "Unknown content type"}
      </p>
      {check.error ? (
        <p role="alert">
          Source Check failed: {check.error}. Historical snapshot remains
          unchanged.
        </p>
      ) : null}
      {check.candidate ? (
        <>
          <div className="flex flex-col gap-4 md:flex-row">
            <fieldset
              aria-label="Historical snapshot"
              className="min-w-0 flex-1 space-y-2"
            >
              <h5>Historical snapshot · Version {version.revision}</h5>
              <p>{version.title}</p>
              <p className="break-all">{version.url}</p>
              <p>{formatAccountDateTime(version.accessedAt, preferences)}</p>
              <p className="whitespace-pre-wrap break-words">
                {version.capturedContent}
              </p>
            </fieldset>
            <fieldset
              aria-label="Candidate snapshot"
              className="min-w-0 flex-1 space-y-2"
            >
              <h5>Candidate snapshot</h5>
              <p>{check.candidate.title}</p>
              <p className="break-all">{check.candidate.url}</p>
              <p>
                {formatAccountDateTime(check.candidate.accessedAt, preferences)}
              </p>
              <p className="whitespace-pre-wrap break-words">
                {check.candidate.capturedContent}
              </p>
            </fieldset>
          </div>
          <fieldset
            aria-label="Compare"
            className="whitespace-pre-wrap break-words font-mono text-sm"
          >
            {parts?.map((part, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: Read-only diff chunks have no stable identity.
                key={index}
              >
                <span className="font-semibold">{partLabel(part)}</span>
                {part.value}
              </div>
            ))}
            {parts ? null : (
              <p>Line comparison unavailable. Use the snapshots above.</p>
            )}
          </fieldset>
          <p className="break-all text-muted-foreground text-xs">
            Fingerprint: {check.fingerprint}
          </p>
          {pins.map((pin, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Read-only captured pin comparisons.
            <p key={index}>
              Version {pin.source.revision} · Range {pin.start}–{pin.end}:{" "}
              {pin.excerpt} ·{" "}
              {findSourceEvidenceMatch(
                pin.excerpt,
                check.candidate?.capturedContent ?? "",
              )
                ? "Exact text match available for explicit preview"
                : "No match in candidate version"}
            </p>
          ))}
        </>
      ) : null}
      {check.decision ? (
        <p role="status">
          {check.decision}
          {check.approvedRevision ? ` · Version ${check.approvedRevision}` : ""}
        </p>
      ) : null}
    </fieldset>
  );
}
