import { GITHUB_API_VERSION } from "@cantiara/api/github-integration";
import { App, Octokit } from "octokit";

import {
  type GitHubCall,
  GitHubRequestError,
  type GitHubTransport,
} from "./github-app-gateway";

/** `Retry-After`, else the seconds until the rate-limit window resets. */
function retryAfterOf(error: unknown, nowMs: number) {
  const headers =
    error instanceof Error &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "headers" in error.response &&
    typeof error.response.headers === "object" &&
    error.response.headers !== null
      ? (error.response.headers as Record<string, string | undefined>)
      : {};
  const retryAfter = Number(headers["retry-after"]);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.ceil(retryAfter);
  }
  const reset = Number(headers["x-ratelimit-reset"]);
  if (headers["x-ratelimit-remaining"] === "0" && Number.isFinite(reset)) {
    return Math.max(1, Math.ceil(reset - nowMs / 1000));
  }
}

function statusOf(error: unknown) {
  return error instanceof Error &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : null;
}

/** A GitHub read or mint must never hold its unit of work indefinitely. */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Octokit adapter of the GitHub transport port. It sends whatever the
 * allow-listed gateway hands it; the allow-list lives above this adapter, so
 * Octokit's wider API surface is never reachable from the integration.
 */
export function createOctokitTransport(options: {
  appId: number;
  privateKey: string;
}): GitHubTransport {
  const app = new App({
    appId: options.appId,
    privateKey: options.privateKey.replaceAll("\\n", "\n"),
  });

  return {
    async request(call: GitHubCall) {
      const client =
        call.auth.kind === "app"
          ? app.octokit
          : new Octokit({ auth: call.auth.token });
      try {
        const response = await client.request(call.route, {
          ...call.params,
          headers: { "x-github-api-version": GITHUB_API_VERSION },
          request: { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
        });
        return response.data;
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
          throw new Error("A GitHub request timed out.", {
            cause: error,
          });
        }
        const status = statusOf(error);
        if (status === null) {
          throw error;
        }
        // biome-ignore lint/style/useErrorCause: Octokit errors can carry the request token in headers.
        throw new GitHubRequestError(status, retryAfterOf(error, Date.now()));
      }
    },
  };
}
