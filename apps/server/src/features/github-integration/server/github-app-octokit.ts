import { GITHUB_API_VERSION } from "@cantiara/api/github-integration";
import { App, Octokit } from "octokit";

import {
  type GitHubCall,
  GitHubRequestError,
  type GitHubTransport,
} from "./github-app-gateway";

function statusOf(error: unknown) {
  return error instanceof Error &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : null;
}

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
        });
        return response.data;
      } catch (error) {
        const status = statusOf(error);
        if (status === null) {
          throw error;
        }
        // biome-ignore lint/style/useErrorCause: Octokit errors can carry the request token in headers.
        throw new GitHubRequestError(status);
      }
    },
  };
}
