import {
  assertGitHubRequestAllowed,
  GitHubEndpointRefusedError,
} from "@cantiara/api/github-integration";
import {
  deriveReviewerStates,
  GITHUB_PR_CONTEXT_CARD_LABEL,
  GITHUB_REVIEWER_STATES,
} from "@cantiara/api/github-pr-context";
import { describe, expect, test } from "vitest";

import {
  accountId,
  archivedProjectId,
  createMemoryHarness,
  otherAccountId,
  projectId,
} from "../github-integration-memory-store";

const WRITE_MEMBER =
  /^(review|approve|merge|closeWork|completeWork|markReady)/i;
const READY_KEY = /ready|mergeable|approved|complete/i;
const INSTALLATION = 900;
const REPOSITORY = 11;
const HEAD = "c".repeat(40);

type Harness = ReturnType<typeof createMemoryHarness>;

function seeded() {
  const harness = createMemoryHarness();
  harness.app.install(INSTALLATION, "acme", [
    { id: REPOSITORY, name: "web", owner: "acme" },
  ]);
  const work = harness.work.add(projectId, {
    key: "CAN-1",
    title: "Checkout retry",
  });
  harness.work.setContext(work.id, {
    expectedOutcome: "A failed payment retries once.",
    problemOpportunity: "Checkout drops on a flaky network.",
    records: [
      {
        recordId: "decision-1",
        recordType: "Decision",
        state: "Valid",
        title: "Retry once",
      },
      {
        recordId: "risk-open",
        recordType: "Risk",
        state: "Open",
        title: "Double charge",
      },
      {
        recordId: "risk-done",
        recordType: "Risk",
        state: "Resolved",
        title: "Old timeout risk",
      },
      {
        recordId: "feedback-1",
        recordType: "Feedback",
        state: "New",
        title: "Customer lost the cart",
      },
      {
        recordId: "release-1",
        recordType: "Project Release",
        state: "Draft",
        title: "1.4.0",
      },
    ],
  });
  harness.app.addIssue(INSTALLATION, REPOSITORY, {
    body: "Fixes CAN-1",
    id: 7001,
    number: 7,
    pullRequest: true,
    title: "Retry checkout",
    updatedAt: "2026-09-30T11:00:00.000Z",
  });
  harness.app.addIssue(INSTALLATION, REPOSITORY, {
    id: 7002,
    number: 8,
    pullRequest: true,
    title: "Unlinked change",
    updatedAt: "2026-09-30T11:00:00.000Z",
  });
  harness.app.setPullRequestChecks(INSTALLATION, REPOSITORY, {
    checkRuns: [{ id: 1, name: "build", conclusion: "success" }],
    headSha: HEAD,
    number: 7,
  });
  return { harness, work };
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

const cards = async (harness: Harness) =>
  (await harness.github.prContext(accountId, { projectId })).cards;

async function cardOf(harness: Harness) {
  const [card] = await cards(harness);
  if (!card) {
    throw new Error("No PR Context Card");
  }
  return card;
}

describe("PR Context Card: drill-down", () => {
  test("uses the exact English label", () => {
    expect(GITHUB_PR_CONTEXT_CARD_LABEL).toBe("PR Context Card");
  });

  test("derives problem, outcome, Karar, open Risk, Feedback, Release, role and checks from owner records", async () => {
    const { harness, work } = seeded();
    await connect(harness);
    const card = await cardOf(harness);
    expect(card).toMatchObject({
      number: 7,
      sourceState: "open",
      title: "Retry checkout",
    });
    expect(card.roles).toEqual([
      expect.objectContaining({
        role: "Required for completion",
        work: { id: work.id, key: "CAN-1", title: "Checkout retry" },
      }),
    ]);
    expect(card.problemSources).toEqual([
      {
        text: "Checkout drops on a flaky network.",
        work: { id: work.id, key: "CAN-1", title: "Checkout retry" },
      },
    ]);
    expect(card.expectedOutcomes[0]?.text).toBe(
      "A failed payment retries once.",
    );
    expect(card.decisions.map((row) => row.recordId)).toEqual(["decision-1"]);
    // Only the open Risk is on the card; the owner keeps the resolved one.
    expect(card.openRisks.map((row) => row.recordId)).toEqual(["risk-open"]);
    expect(card.feedback.map((row) => row.recordId)).toEqual(["feedback-1"]);
    expect(card.targetReleases.map((row) => row.recordId)).toEqual([
      "release-1",
    ]);
    expect(card.decisions[0]?.viaWorkKeys).toEqual(["CAN-1"]);
    expect(card.checks.headSha).toBe(HEAD);
    expect(card.checks.rollup.total).toBe(1);
  });

  test("a Contextual role is shown as Contextual and an unlinked Pull request has no card", async () => {
    const { harness, work } = seeded();
    const link = await connect(harness);
    expect(link.repositoryId).toBe(REPOSITORY);
    const [pull] = await cards(harness);
    const links = await harness.github.workLinks(accountId, { projectId });
    expect(links.links).toHaveLength(1);
    await harness.github.unlinkWork(accountId, {
      linkId: links.links[0]?.id ?? "",
      projectId,
    });
    expect(await cards(harness)).toEqual([]);
    await harness.github.linkWork(accountId, {
      projectId,
      role: "Contextual",
      target: { kind: "record", recordId: pull?.recordId ?? "" },
      workId: work.id,
    });
    expect((await cardOf(harness)).roles[0]?.role).toBe("Contextual");
  });

  test("a record owned by the Work is read live, never copied", async () => {
    const { harness, work } = seeded();
    await connect(harness);
    harness.work.setContext(work.id, {
      expectedOutcome: "Changed at the owner.",
      problemOpportunity: null,
      records: [],
    });
    const card = await cardOf(harness);
    expect(card.expectedOutcomes[0]?.text).toBe("Changed at the owner.");
    expect(card.problemSources).toEqual([]);
    expect(card.decisions).toEqual([]);
    expect(harness.stored()).not.toHaveProperty("prContextCards");
  });

  test("a trashed Work is not on the card", async () => {
    const { harness, work } = seeded();
    await connect(harness);
    harness.work.trash(work.id);
    const card = await cardOf(harness);
    expect(card.roles).toEqual([]);
    expect(card.problemSources).toEqual([]);
  });

  test("another account reads no card", async () => {
    const { harness } = seeded();
    await connect(harness);
    await expect(
      harness.github.prContext(otherAccountId, { projectId }),
    ).rejects.toThrow();
  });
});

describe("PR Context Card: read-only counterparts", () => {
  test("the access has no review, approve, merge or close-Work member", () => {
    const { harness } = seeded();
    const members = Object.keys(harness.github);
    expect(members).toContain("prContext");
    for (const member of members) {
      expect(member).not.toMatch(WRITE_MEMBER);
    }
  });

  test("reading the card writes no Work, link, role or signal and sends no GitHub write", async () => {
    const { harness } = seeded();
    await connect(harness);
    const before = {
      links: structuredClone(harness.stored().workLinks),
      signals: structuredClone(harness.stored().signals),
      works: harness.work.snapshot(),
    };
    await cards(harness);
    await cards(harness);
    expect(harness.stored().workLinks).toEqual(before.links);
    expect(harness.stored().signals).toEqual(before.signals);
    expect(harness.work.snapshot()).toEqual(before.works);
    for (const request of harness.app.requests) {
      expect(
        request.route.startsWith("GET ") ||
          request.route ===
            "POST /app/installations/{installation_id}/access_tokens",
      ).toBe(true);
    }
  });

  test("a missing link is never filled in and the Pull request is never declared ready", async () => {
    const { harness } = seeded();
    await connect(harness);
    const linksBefore = (
      await harness.github.workLinks(accountId, { projectId })
    ).links;
    const card = await cardOf(harness);
    expect(card).not.toHaveProperty("readyDeclared");
    for (const key of Object.keys(card)) {
      expect(key).not.toMatch(READY_KEY);
    }
    // The unlinked Pull request #8 got no card and no link from reading.
    expect((await cards(harness)).map((item) => item.number)).toEqual([7]);
    expect(
      (await harness.github.workLinks(accountId, { projectId })).links,
    ).toEqual(linksBefore);
  });

  test("the card is not a Work Context Card: it holds no editable fields, sections or Work lifecycle", async () => {
    const { harness } = seeded();
    await connect(harness);
    const card = await cardOf(harness);
    expect(Object.keys(card).sort()).toEqual(
      [
        "checks",
        "decisions",
        "expectedOutcomes",
        "feedback",
        "htmlUrl",
        "number",
        "openRisks",
        "problemSources",
        "recordId",
        "reviewers",
        "roles",
        "sourceState",
        "targetReleases",
        "title",
      ].sort(),
    );
    expect(card.roles[0]?.work).not.toHaveProperty("status");
  });

  test("an archived Project reads the card as read-only", async () => {
    const { harness } = seeded();
    await connect(harness);
    harness.archiveProject(projectId);
    expect(
      (await harness.github.prContext(accountId, { projectId })).readOnly,
    ).toBe(true);
    expect(archivedProjectId).not.toBe(projectId);
  });
});

describe("PR Context Card: reviewer states", () => {
  test("the catalog is closed", () => {
    expect([...GITHUB_REVIEWER_STATES]).toEqual([
      "Pending",
      "Approved",
      "Changes requested",
      "Commented",
    ]);
  });

  test("shows Pending, Approved, Changes requested and Commented only when GitHub supplies them", async () => {
    const { harness } = seeded();
    await connect(harness);
    expect((await cardOf(harness)).reviewers).toEqual([]);
    harness.app.setPullRequestReviewers(INSTALLATION, REPOSITORY, 7, {
      requested: ["dana"],
      reviews: [
        {
          login: "ali",
          state: "APPROVED",
          submittedAt: "2026-10-01T08:00:00Z",
        },
        { login: "bo", state: "CHANGES_REQUESTED" },
        { login: "cem", state: "COMMENTED" },
      ],
    });
    const card = await cardOf(harness);
    expect(
      card.reviewers.map((reviewer) => [reviewer.login, reviewer.state]),
    ).toEqual([
      ["ali", "Approved"],
      ["bo", "Changes requested"],
      ["cem", "Commented"],
      ["dana", "Pending"],
    ]);
  });

  test("a failing GitHub reviewer read shows no reviewers and does not fail the card", async () => {
    const { harness } = seeded();
    await connect(harness);
    harness.app.setPullRequestReviewers(INSTALLATION, REPOSITORY, 7, {
      reviews: [{ login: "ali", state: "APPROVED" }],
    });
    harness.app.failReviewerReads(true);
    const card = await cardOf(harness);
    expect(card.reviewers).toEqual([]);
    expect(card.roles).toHaveLength(1);
  });

  test("reviewer states raise no attention signal and add no signal type", async () => {
    const { harness } = seeded();
    await connect(harness);
    const signalsBefore = await harness.github.attentionSignals(accountId, {
      projectId,
    });
    harness.app.setPullRequestReviewers(INSTALLATION, REPOSITORY, 7, {
      requested: ["dana"],
      reviews: [{ login: "bo", state: "CHANGES_REQUESTED" }],
    });
    await cardOf(harness);
    expect(
      await harness.github.attentionSignals(accountId, { projectId }),
    ).toEqual(signalsBefore);
    expect(harness.stored().signals.map((signal) => signal.signalType)).toEqual(
      signalsBefore.map((signal) => signal.signalType),
    );
  });

  test("a re-requested reviewer is Pending, a dismissed or draft review says nothing, a decisive review beats a later comment", () => {
    expect(
      deriveReviewerStates({
        requested: ["ali"],
        reviews: [
          {
            login: "ali",
            state: "APPROVED",
            submittedAt: "2026-10-01T08:00:00Z",
            url: null,
          },
          {
            login: "bo",
            state: "DISMISSED",
            submittedAt: "2026-10-01T08:00:00Z",
            url: null,
          },
          {
            login: "cem",
            state: "PENDING",
            submittedAt: "2026-10-01T08:00:00Z",
            url: null,
          },
          {
            login: "dana",
            state: "APPROVED",
            submittedAt: "2026-10-01T08:00:00Z",
            url: null,
          },
          {
            login: "dana",
            state: "COMMENTED",
            submittedAt: "2026-10-01T09:00:00Z",
            url: null,
          },
        ],
      }).map((reviewer) => [reviewer.login, reviewer.state]),
    ).toEqual([
      ["ali", "Pending"],
      ["dana", "Approved"],
    ]);
  });
});

describe("PR Context Card: allow-list", () => {
  test("reviews and requested reviewers are allowed as reads only", () => {
    expect(
      assertGitHubRequestAllowed("GET /repos/acme/web/pulls/7/reviews"),
    ).toBe("Pull requests");
    expect(
      assertGitHubRequestAllowed(
        "GET /repos/acme/web/pulls/7/requested_reviewers",
      ),
    ).toBe("Pull requests");
  });

  test("diff, files, comments, merge and review writes stay refused", () => {
    for (const request of [
      "GET /repos/acme/web/pulls/7",
      "GET /repos/acme/web/pulls/7.diff",
      "GET /repos/acme/web/pulls/7/files",
      "GET /repos/acme/web/pulls/7/comments",
      "PUT /repos/acme/web/pulls/7/merge",
      "POST /repos/acme/web/pulls/7/reviews",
      "POST /repos/acme/web/pulls/7/requested_reviewers",
      "DELETE /repos/acme/web/pulls/7/requested_reviewers",
      "POST /repos/acme/web/pulls/7/reviews/1/events",
    ]) {
      expect(() => assertGitHubRequestAllowed(request)).toThrow(
        GitHubEndpointRefusedError,
      );
    }
  });
});
