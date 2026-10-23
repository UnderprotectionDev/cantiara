// biome-ignore-all lint/performance/noAwaitInLoops: The refused log routes are checked one after another.
import {
  GITHUB_CHECK_ACTION_LABEL,
  GITHUB_CHECK_REQUIREMENTS,
} from "@cantiara/api/github-checks";
import {
  assertGitHubRequestAllowed,
  GitHubEndpointRefusedError,
  gitHubRoutePermission,
} from "@cantiara/api/github-integration";
import { describe, expect, test } from "vitest";

import {
  accountId,
  createMemoryHarness,
  projectId,
} from "../github-integration-memory-store";
import { toWebhookEvents } from "../github-webhook-events";

const INSTALLATION = 900;
const REPOSITORY = 11;
const HEAD_A = "a".repeat(40);
const HEAD_B = "b".repeat(40);
const CHECK_ROUTES = [
  "GET /repos/{owner}/{repo}/pulls",
  "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
  "GET /repos/{owner}/{repo}/commits/{ref}/status",
];

type Harness = ReturnType<typeof createMemoryHarness>;

function seeded() {
  const harness = createMemoryHarness();
  harness.app.install(INSTALLATION, "acme", [
    { id: REPOSITORY, name: "web", owner: "acme" },
  ]);
  harness.app.addIssue(INSTALLATION, REPOSITORY, {
    id: 7001,
    number: 7,
    pullRequest: true,
    title: "Retry checkout",
    updatedAt: "2026-09-30T11:00:00.000Z",
  });
  return harness;
}

async function connect(harness: Harness) {
  const { installUrl } = await harness.github.startInstall(accountId, {
    projectId,
  });
  const state = new URL(installUrl).searchParams.get("state") ?? "";
  await harness.github.completeInstall(accountId, {
    installationId: INSTALLATION,
    state,
  });
  return await harness.github.linkRepository(accountId, {
    installationId: INSTALLATION,
    projectId,
    repositoryId: REPOSITORY,
  });
}

const summary = async (harness: Harness) => {
  const { pullRequests } = await harness.github.checks(accountId, {
    projectId,
  });
  const [pull] = pullRequests;
  if (!pull) {
    throw new Error("No pull request summary");
  }
  return pull;
};

async function resync(harness: Harness, linkId: string) {
  harness.clock.current = new Date(harness.clock.current.getTime() + 60_000);
  await harness.github.syncNow(accountId, { linkId, projectId });
}

function checkRunPayload(options: {
  conclusion: string | null;
  headSha: string;
  id: number;
  name: string;
  pullRequests?: number[];
  required?: boolean;
  status?: string;
}) {
  return {
    action: "completed",
    check_run: {
      app: { slug: "github-actions" },
      conclusion: options.conclusion,
      head_sha: options.headSha,
      html_url: `https://github.com/acme/web/runs/${options.id}`,
      id: options.id,
      name: options.name,
      pull_requests: (options.pullRequests ?? [7]).map((number) => ({
        number,
      })),
      ...(options.required === undefined
        ? {}
        : { is_required: options.required }),
      status: options.status ?? "completed",
    },
    installation: { id: INSTALLATION },
    repository: {
      full_name: "acme/web",
      html_url: "https://github.com/acme/web",
      id: REPOSITORY,
      name: "web",
      owner: { login: "acme" },
    },
  };
}

async function applyEvent(
  harness: Harness,
  event: string,
  payload: Record<string, unknown>,
) {
  for (const parsed of toWebhookEvents(event, payload)) {
    await harness.github.applyWebhookEvent(parsed);
  }
}

describe("PR check summary: head SHA, provider + stable id, requiredness", () => {
  test("shows only the current head SHA with provider and stable check id", async () => {
    const harness = seeded();
    harness.app.setPullRequestChecks(INSTALLATION, REPOSITORY, {
      checkRuns: [
        { conclusion: "success", id: 101, name: "build" },
        { conclusion: "failure", id: 102, name: "e2e" },
        { id: 103, name: "lint", status: "in_progress" },
      ],
      headSha: HEAD_A,
      number: 7,
      statuses: [{ context: "ci/legacy", state: "success" }],
    });
    await connect(harness);
    const pull = await summary(harness);
    expect(pull.headSha).toBe(HEAD_A);
    expect(
      pull.checks.map((check) => [
        check.provider,
        check.checkId,
        check.outcome,
      ]),
    ).toEqual([
      ["github-actions", "102", "Failed"],
      ["github-actions", "101", "Passed"],
      ["commit-status", "ci/legacy", "Passed"],
      ["github-actions", "103", "Pending"],
    ]);
    expect(pull.rollup).toMatchObject({
      actionNeeded: 1,
      pending: 1,
      sourceUrl: "https://github.com/acme/web/pull/7/checks",
      total: 4,
    });
  });

  test("Required only when GitHub says so; everything else is Unknown, never inferred from the name", async () => {
    const harness = seeded();
    harness.app.setPullRequestChecks(INSTALLATION, REPOSITORY, {
      checkRuns: [
        { conclusion: "success", id: 1, name: "build", required: true },
        { conclusion: "success", id: 2, name: "required-looking-name" },
        { conclusion: "success", id: 3, name: "optional", required: false },
      ],
      headSha: HEAD_A,
      number: 7,
    });
    await connect(harness);
    const byId = Object.fromEntries(
      (await summary(harness)).checks.map((check) => [
        check.checkId,
        check.requirement,
      ]),
    );
    expect(byId).toEqual({ "1": "Required", "2": "Unknown", "3": "Unknown" });
    expect([...GITHUB_CHECK_REQUIREMENTS]).toEqual(["Required", "Unknown"]);
  });

  test("a Required a payload stated survives the REST read of the same check", async () => {
    const harness = seeded();
    // The REST read carries no requiredness; the payload is the only statement.
    harness.app.setPullRequestChecks(INSTALLATION, REPOSITORY, {
      checkRuns: [{ conclusion: "success", id: 1, name: "build" }],
      headSha: HEAD_A,
      number: 7,
    });
    const link = await connect(harness);
    expect(
      (await summary(harness)).checks.map((check) => check.requirement),
    ).toEqual(["Unknown"]);
    await applyEvent(
      harness,
      "check_run",
      checkRunPayload({
        conclusion: "success",
        headSha: HEAD_A,
        id: 1,
        name: "build",
        required: true,
      }),
    );
    expect(
      (await summary(harness)).checks.map((check) => check.requirement),
    ).toEqual(["Required"]);
    await resync(harness, link.id);
    expect(
      (await summary(harness)).checks.map((check) => check.requirement),
    ).toEqual(["Required"]);
  });

  test("the webhook Pull request payload resolves the record through the issue-domain identity", () => {
    const [event] = toWebhookEvents("pull_request", {
      action: "synchronize",
      installation: { id: INSTALLATION },
      pull_request: {
        html_url: "https://github.com/acme/web/pull/7",
        // GitHub's own pull request id, a different sequence from the issue id.
        id: 7003,
        issue_url: "https://api.github.com/repos/acme/web/issues/5003",
        labels: [],
        number: 7,
        state: "open",
        title: "Retry checkout",
        updated_at: "2026-10-01T10:00:00.000Z",
      },
      repository: {
        full_name: "acme/web",
        html_url: "https://github.com/acme/web",
        id: REPOSITORY,
        name: "web",
        owner: { login: "acme" },
      },
    });
    if (event?.kind !== "record") {
      throw new Error("Expected a record event");
    }
    expect(event.snapshot.githubId).toBe(5003);
  });
});

describe("PR check summary: superseded results", () => {
  test("a new head SHA replaces the old results and the old ones are never current", async () => {
    const harness = seeded();
    harness.app.setPullRequestChecks(INSTALLATION, REPOSITORY, {
      checkRuns: [{ conclusion: "failure", id: 1, name: "build" }],
      headSha: HEAD_A,
      number: 7,
    });
    const link = await connect(harness);
    expect((await summary(harness)).checks[0]?.outcome).toBe("Failed");

    harness.app.setPullRequestChecks(INSTALLATION, REPOSITORY, {
      checkRuns: [{ conclusion: "success", id: 2, name: "build" }],
      headSha: HEAD_B,
      number: 7,
    });
    await resync(harness, link.id);
    const pull = await summary(harness);
    expect(pull.headSha).toBe(HEAD_B);
    expect(pull.checks.map((check) => check.checkId)).toEqual(["2"]);
    expect(pull.checks[0]?.outcome).toBe("Passed");
  });

  test("a late webhook for an older SHA is kept as superseded and not shown as current", async () => {
    const harness = seeded();
    harness.app.setPullRequestChecks(INSTALLATION, REPOSITORY, {
      checkRuns: [{ conclusion: "success", id: 2, name: "build" }],
      headSha: HEAD_B,
      number: 7,
    });
    await connect(harness);
    await applyEvent(
      harness,
      "check_run",
      checkRunPayload({
        conclusion: "failure",
        headSha: HEAD_A,
        id: 1,
        name: "build",
      }),
    );
    const pull = await summary(harness);
    expect(pull.checks.map((check) => check.checkId)).toEqual(["2"]);
    expect(pull.supersededCount).toBe(1);
    expect(pull.rollup.actionNeeded).toBe(0);
    const { signals } = await harness.github.workLinks(accountId, {
      projectId,
    });
    expect(
      signals.filter((signal) => signal.signalType === "failed-check"),
    ).toEqual([]);
  });

  test("a check that arrives before the new head is shown once the head is known", async () => {
    const harness = seeded();
    harness.app.setPullRequestChecks(INSTALLATION, REPOSITORY, {
      checkRuns: [{ conclusion: "success", id: 1, name: "build" }],
      headSha: HEAD_A,
      number: 7,
    });
    await connect(harness);
    await applyEvent(
      harness,
      "check_run",
      checkRunPayload({
        conclusion: "success",
        headSha: HEAD_B,
        id: 2,
        name: "build",
      }),
    );
    expect((await summary(harness)).checks.map((c) => c.checkId)).toEqual([
      "1",
    ]);
    await applyEvent(harness, "pull_request", {
      action: "synchronize",
      installation: { id: INSTALLATION },
      pull_request: {
        head: { ref: "retry", sha: HEAD_B },
        html_url: "https://github.com/acme/web/pull/7",
        id: 7001,
        labels: [],
        number: 7,
        state: "open",
        title: "Retry checkout",
        updated_at: "2026-10-01T10:00:00.000Z",
      },
      repository: {
        full_name: "acme/web",
        html_url: "https://github.com/acme/web",
        id: REPOSITORY,
        name: "web",
        owner: { login: "acme" },
      },
    });
    const pull = await summary(harness);
    expect(pull.headSha).toBe(HEAD_B);
    expect(pull.checks.map((check) => check.checkId)).toEqual(["2"]);
  });

  test("a bare commit status lands on the Pull request whose head it is", async () => {
    const harness = seeded();
    harness.app.setPullRequestChecks(INSTALLATION, REPOSITORY, {
      checkRuns: [],
      headSha: HEAD_A,
      number: 7,
    });
    await connect(harness);
    await applyEvent(harness, "status", {
      context: "ci/legacy",
      installation: { id: INSTALLATION },
      repository: {
        full_name: "acme/web",
        id: REPOSITORY,
        name: "web",
        owner: { login: "acme" },
      },
      sha: HEAD_A,
      state: "failure",
    });
    const pull = await summary(harness);
    expect(pull.checks).toMatchObject([
      {
        actionNeeded: true,
        checkId: "ci/legacy",
        outcome: "Failed",
        provider: "commit-status",
        requirement: "Unknown",
      },
    ]);
  });
});

describe("PR check summary: Action needed signal", () => {
  test("a failed check on the current head raises one source-linked signal; Work is not touched", async () => {
    const harness = seeded();
    harness.work.add(projectId, { key: "CAN-1", title: "Checkout" });
    const before = harness.work.snapshot();
    harness.app.setPullRequestChecks(INSTALLATION, REPOSITORY, {
      checkRuns: [{ conclusion: "failure", id: 1, name: "build" }],
      headSha: HEAD_A,
      number: 7,
    });
    const link = await connect(harness);
    await resync(harness, link.id);
    const { signals } = await harness.github.workLinks(accountId, {
      projectId,
    });
    const failed = signals.filter(
      (signal) => signal.signalType === "failed-check",
    );
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({
      presentation: "Action Required",
      record: { htmlUrl: "https://github.com/acme/web/pull/7", number: 7 },
      work: null,
    });
    expect(harness.work.snapshot()).toEqual(before);
    expect((await summary(harness)).checks[0]?.actionNeeded).toBe(true);
    expect(GITHUB_CHECK_ACTION_LABEL).toBe("Action needed");
  });

  test("the signal ends when a new head supersedes the failed check and a dismissal holds", async () => {
    const harness = seeded();
    harness.app.setPullRequestChecks(INSTALLATION, REPOSITORY, {
      checkRuns: [{ conclusion: "failure", id: 1, name: "build" }],
      headSha: HEAD_A,
      number: 7,
    });
    const link = await connect(harness);
    const open = async () =>
      (await harness.github.attentionSignals(accountId, { projectId })).filter(
        (signal) => signal.signalType === "failed-check",
      );
    const [raised] = await open();
    expect(raised).toBeDefined();
    await resync(harness, link.id);
    expect(await open()).toHaveLength(1);
    if (raised) {
      await harness.github.dismissSignal(accountId, {
        projectId,
        signalId: raised.signalId,
      });
    }
    await resync(harness, link.id);
    expect(await open()).toHaveLength(0);

    harness.app.setPullRequestChecks(INSTALLATION, REPOSITORY, {
      checkRuns: [{ conclusion: "success", id: 2, name: "build" }],
      headSha: HEAD_B,
      number: 7,
    });
    await resync(harness, link.id);
    expect(await open()).toHaveLength(0);
  });
});

describe("PR check summary is not a Test Session", () => {
  test("checks never become Test Session, Session Test, scenario result or release gate rows", async () => {
    const harness = seeded();
    harness.app.setPullRequestChecks(INSTALLATION, REPOSITORY, {
      checkRuns: [
        { conclusion: "success", id: 1, name: "unit tests" },
        { conclusion: "failure", id: 2, name: "e2e flows" },
      ],
      headSha: HEAD_A,
      number: 7,
    });
    harness.work.add(projectId, { key: "CAN-1", title: "Checkout" });
    const works = harness.work.snapshot();
    await connect(harness);
    const stored = harness.stored();
    // The only state the check path writes is this seam's own head and check rows.
    expect(Object.keys(stored).sort()).toEqual(
      [
        "archivedProjects",
        "archivedRecords",
        "checks",
        // The owner-record fixture the PR Context Card reads; the seam never writes it.
        "contextFacts",
        "credentials",
        "history",
        "installations",
        "linkHistory",
        "links",
        "pullHeads",
        "records",
        "signals",
        "suggestions",
        "tombstones",
        "trashedRecords",
        "workLinks",
        "works",
      ].sort(),
    );
    expect(stored.checks).toHaveLength(2);
    // A check row has no field that could carry a test-session identity.
    expect(Object.keys(stored.checks[0] ?? {}).sort()).toEqual([
      "checkId",
      "detailsUrl",
      "headSha",
      "name",
      "observedAt",
      "outcome",
      "projectId",
      "provider",
      "recordId",
      "required",
      "requirement",
    ]);
    expect(harness.work.snapshot()).toEqual(works);
    const pull = await summary(harness);
    expect(Object.keys(pull).sort()).toEqual([
      "checks",
      "headSha",
      "number",
      "recordId",
      "rollup",
      "supersededCount",
      "title",
    ]);
  });
});

describe("PR check summary: Checks permission only", () => {
  test("reads go through the allow-listed gateway; logs, annotations and reruns are refused", async () => {
    const harness = seeded();
    harness.app.setPullRequestChecks(INSTALLATION, REPOSITORY, {
      checkRuns: [{ conclusion: "success", id: 1, name: "build" }],
      headSha: HEAD_A,
      number: 7,
    });
    await connect(harness);
    const checkRoutes = harness.app.requests
      .map((request) => request.route)
      .filter((route) => route.includes("check") || route.includes("status"));
    expect(new Set(checkRoutes)).toEqual(new Set(CHECK_ROUTES.slice(1)));
    expect(
      gitHubRoutePermission("GET /repos/acme/web/commits/abc/check-runs"),
    ).toBe("Checks");
    expect(
      gitHubRoutePermission("GET /repos/acme/web/commits/abc/status"),
    ).toBe("Commit statuses");
    for (const route of [
      "GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs",
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs",
      "GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations",
      "POST /repos/{owner}/{repo}/check-runs/{check_run_id}/rerequest",
      "POST /repos/{owner}/{repo}/check-suites/{check_suite_id}/rerequest",
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun",
      "POST /repos/{owner}/{repo}/check-runs",
    ]) {
      expect(() => assertGitHubRequestAllowed(route)).toThrow(
        GitHubEndpointRefusedError,
      );
    }
  });

  test("a Pull request GitHub reports no checks for shows an empty summary, not an error", async () => {
    const harness = seeded();
    await connect(harness);
    const pull = await summary(harness);
    expect(pull.checks).toEqual([]);
    expect(pull.headSha).toBeNull();
  });
});
