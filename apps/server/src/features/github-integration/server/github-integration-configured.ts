import { randomBytes } from "node:crypto";

import type { Database } from "@cantiara/db";

import { createGitHubAppGateway } from "./github-app-gateway";
import { createOctokitTransport } from "./github-app-octokit";
import {
  createGitHubSecrets,
  type GitHubKeyRing,
  parseGitHubKeyRing,
} from "./github-credential-envelope";
import { createDatabaseGitHubIntegration } from "./github-integration-database";
import {
  createGitHubWebhookInbox,
  type GitHubWebhookInbox,
} from "./github-webhook-inbox";
import { createDatabaseInboxStore } from "./github-webhook-inbox-database";
import { logOperatorAlarm } from "./github-webhook-worker";

export interface GitHubAppConfiguration {
  appId?: number;
  appSlug?: string;
  keyRing?: string;
  keyVersion: number;
  privateKey?: string;
}

/**
 * GitHub Integration wired to PostgreSQL. Without the App credentials the
 * gateway is `null`: the Project GitHub area then says the App is not
 * configured instead of failing, and no outbound call exists.
 */
export function createConfiguredGitHubIntegration(
  database: Database,
  configuration: GitHubAppConfiguration,
) {
  const { appId, appSlug, keyRing, keyVersion, privateKey } = configuration;
  const configured = Boolean(appId && appSlug && keyRing && privateKey);
  const ring: GitHubKeyRing =
    configured && keyRing
      ? parseGitHubKeyRing(keyRing, keyVersion)
      : {
          currentVersion: 1,
          keys: new Map([[1, randomBytes(32)]]),
        };
  const secrets = createGitHubSecrets(ring);
  const integration = createDatabaseGitHubIntegration({
    database,
    gateway:
      configured && appId && appSlug && privateKey
        ? createGitHubAppGateway({
            appSlug,
            transport: createOctokitTransport({ appId, privateKey }),
          })
        : null,
    secrets,
  });
  return {
    integration,
    /** The durable webhook inbox over the same envelope keys and integration. */
    webhookInbox: (inboxOptions: {
      bootstrapSecret?: string;
      enqueue: (deliveryId: string) => Promise<void>;
    }): GitHubWebhookInbox =>
      createGitHubWebhookInbox({
        alarm: logOperatorAlarm,
        bootstrapSecret: inboxOptions.bootstrapSecret,
        enqueue: inboxOptions.enqueue,
        integration,
        secrets,
        store: createDatabaseInboxStore(database),
      }),
  };
}
