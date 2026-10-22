import type {
  GitHubCheckOutcome,
  GitHubObservedCheck,
} from "@cantiara/api/github-checks";

/**
 * Maps the GitHub check payloads (REST and webhook) to the content-free check
 * the integration stores: provider, stable check id, name, outcome, the GitHub
 * page of the check and requiredness only when GitHub states it. Output text,
 * annotations and logs are never read.
 */

export interface RawCheckRun {
  app?: { slug?: string | null } | null;
  conclusion?: string | null;
  details_url?: string | null;
  html_url?: string | null;
  id: number;
  /** GitHub's own requiredness flag, when the payload carries one. */
  is_required?: boolean | null;
  name: string;
  status?: string | null;
}

export interface RawCommitStatus {
  context: string;
  id?: number;
  state: string;
  target_url?: string | null;
}

export const COMMIT_STATUS_PROVIDER = "commit-status";

const FAILED_CONCLUSIONS = new Set([
  "failure",
  "timed_out",
  "action_required",
  "startup_failure",
]);
const SKIPPED_CONCLUSIONS = new Set(["neutral", "skipped", "stale"]);

export function outcomeOfCheckRun(
  run: Pick<RawCheckRun, "conclusion" | "status">,
): GitHubCheckOutcome {
  if (run.status !== "completed") {
    return "Pending";
  }
  const conclusion = run.conclusion ?? "";
  if (conclusion === "success") {
    return "Passed";
  }
  if (conclusion === "cancelled") {
    return "Cancelled";
  }
  if (FAILED_CONCLUSIONS.has(conclusion)) {
    return "Failed";
  }
  return SKIPPED_CONCLUSIONS.has(conclusion) ? "Skipped" : "Pending";
}

export function outcomeOfStatus(state: string): GitHubCheckOutcome {
  if (state === "success") {
    return "Passed";
  }
  if (state === "failure" || state === "error") {
    return "Failed";
  }
  return "Pending";
}

export function toObservedCheckRun(run: RawCheckRun): GitHubObservedCheck {
  return {
    checkId: String(run.id),
    detailsUrl: run.html_url ?? run.details_url ?? null,
    name: run.name,
    outcome: outcomeOfCheckRun(run),
    provider: run.app?.slug || "unknown-app",
    required: typeof run.is_required === "boolean" ? run.is_required : null,
  };
}

export function toObservedStatus(status: RawCommitStatus): GitHubObservedCheck {
  return {
    checkId: status.context,
    detailsUrl: status.target_url ?? null,
    name: status.context,
    outcome: outcomeOfStatus(status.state),
    provider: COMMIT_STATUS_PROVIDER,
    required: null,
  };
}
