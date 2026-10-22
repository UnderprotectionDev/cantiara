import type { GitHubWebhookEvent } from "@cantiara/api/github-integration";
import { z } from "zod";
import {
  type RawIssue,
  type RawRepository,
  toRepository,
  toSnapshot,
} from "./github-app-gateway";
import { toObservedCheckRun, toObservedStatus } from "./github-check-mapping";

/**
 * Maps a verified webhook payload to the allow-listed events the integration
 * applies. Only the PRD 12 fields survive this step: the free payload (bodies,
 * comments, diffs, user objects) is read for these fields and dropped, never
 * stored on a main record.
 */

const issueLikeSchema = z.object({
  body: z.string().nullable().optional(),
  head: z
    .object({
      ref: z.string().nullable().optional(),
      sha: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  html_url: z.string(),
  id: z.number(),
  labels: z
    .array(z.union([z.string(), z.object({ name: z.string().optional() })]))
    .optional(),
  merged: z.boolean().optional(),
  merged_at: z.string().nullable().optional(),
  milestone: z.object({ title: z.string().optional() }).nullable().optional(),
  number: z.number(),
  pull_request: z
    .object({ merged_at: z.string().nullable().optional() })
    .optional(),
  state: z.string(),
  title: z.string(),
  updated_at: z.string(),
});

const repositorySchema = z.object({
  full_name: z.string().optional(),
  html_url: z.string().optional(),
  id: z.number(),
  name: z.string(),
  owner: z.object({ login: z.string().optional() }).optional(),
  private: z.boolean().optional(),
});

const checkRunSchema = z.object({
  app: z
    .object({ slug: z.string().nullable().optional() })
    .nullable()
    .optional(),
  conclusion: z.string().nullable().optional(),
  details_url: z.string().nullable().optional(),
  head_sha: z.string(),
  html_url: z.string().nullable().optional(),
  id: z.number(),
  name: z.string(),
  pull_requests: z.array(z.object({ number: z.number() })).optional(),
  status: z.string().nullable().optional(),
});

const commitStatusSchema = z.object({
  context: z.string(),
  id: z.number().optional(),
  sha: z.string(),
  state: z.string(),
  target_url: z.string().nullable().optional(),
});

const envelopeSchema = z.object({
  action: z.string().optional(),
  check_run: checkRunSchema.optional(),
  installation: z.object({ id: z.number() }).optional(),
  issue: issueLikeSchema.optional(),
  pull_request: issueLikeSchema.optional(),
  repositories_removed: z.array(repositorySchema).optional(),
  repository: repositorySchema.optional(),
});

export class GitHubWebhookPayloadError extends Error {
  constructor() {
    super("The webhook payload does not have the expected shape.");
    this.name = "GitHubWebhookPayloadError";
  }
}

/** `null` for events the integration does not use (they are acknowledged and ignored). */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: One switch maps every allow-listed webhook event kind to its integration event.
export function toWebhookEvents(
  event: string,
  payload: unknown,
): GitHubWebhookEvent[] {
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new GitHubWebhookPayloadError();
  }
  const body = parsed.data;
  const installationId = body.installation?.id;
  if (installationId === undefined) {
    return [];
  }
  switch (event) {
    case "installation":
      return body.action === "deleted"
        ? [{ installationId, kind: "installation-removed" }]
        : [];
    case "installation_repositories":
      return body.action === "removed"
        ? (body.repositories_removed ?? []).map((repository) => ({
            installationId,
            kind: "repository-access-removed" as const,
            repositoryId: repository.id,
          }))
        : [];
    case "repository": {
      if (!body.repository) {
        return [];
      }
      if (body.action === "deleted") {
        return [
          {
            installationId,
            kind: "repository-missing",
            repositoryId: body.repository.id,
          },
        ];
      }
      if (body.action === "renamed" || body.action === "transferred") {
        return [
          {
            installationId,
            kind: "repository-renamed",
            repository: toRepository(body.repository as RawRepository),
          },
        ];
      }
      return [];
    }
    case "issues": {
      if (!(body.issue && body.repository) || body.action === "deleted") {
        return [];
      }
      return [
        {
          installationId,
          kind: "record",
          repositoryId: body.repository.id,
          snapshot: toSnapshot(body.issue as RawIssue),
        },
      ];
    }
    case "pull_request": {
      if (!(body.pull_request && body.repository)) {
        return [];
      }
      const pull = body.pull_request;
      return [
        {
          installationId,
          kind: "record",
          repositoryId: body.repository.id,
          snapshot: toSnapshot({
            ...pull,
            pull_request: {
              merged_at:
                pull.merged_at ?? (pull.merged ? pull.updated_at : null),
            },
          } as RawIssue),
        },
      ];
    }
    case "check_run": {
      if (!(body.check_run && body.repository)) {
        return [];
      }
      return [
        {
          check: toObservedCheckRun(body.check_run),
          headSha: body.check_run.head_sha,
          installationId,
          kind: "check",
          pullRequestNumbers: (body.check_run.pull_requests ?? []).map(
            (pull) => pull.number,
          ),
          repositoryId: body.repository.id,
        },
      ];
    }
    case "status": {
      const status = commitStatusSchema.safeParse(payload);
      if (!(status.success && body.repository)) {
        return [];
      }
      return [
        {
          check: toObservedStatus(status.data),
          headSha: status.data.sha,
          installationId,
          kind: "check",
          pullRequestNumbers: [],
          repositoryId: body.repository.id,
        },
      ];
    }
    default:
      return [];
  }
}
