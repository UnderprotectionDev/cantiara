// biome-ignore-all lint/performance/useTopLevelRegex: assertions read clearer with inline patterns.
// biome-ignore-all lint/performance/noAwaitInLoops: requests are checked one after another on purpose.

import { BuildInPublicError } from "@cantiara/api/build-in-public";
import { buildInPublicViews } from "@cantiara/api/build-in-public-publication";
import { describe, expect, test } from "vitest";

import {
  ACCOUNT_ID,
  approveItems,
  createFixtures,
  createPublicSite,
  type Fixtures,
  memberFact,
  NOW,
  PROJECT_ID,
  previewOf,
  workFact,
} from "./build-in-public-fixtures";

const release = memberFact({
  date: "2026-09-01",
  fields: [{ name: "Summary", value: "Public release notes" }],
  kind: "Project Release",
  recordId: "release-1",
  title: "Release 1.0",
});
const secretDoc = memberFact({
  fields: [{ name: "Body", value: "Never approved body" }],
  recordId: "doc-secret",
  title: "Private strategy",
});

function latest(fixtures: Fixtures) {
  const snapshot = fixtures.surfaces[0]?.revisions.at(-1);
  if (!snapshot) {
    throw new Error("no snapshot");
  }
  return snapshot;
}

async function feedHtml(fixtures: Fixtures) {
  const site = createPublicSite(fixtures);
  const slug = fixtures.surfaces[0]?.slugs.canonical ?? "";
  const response = await site.get(`/surface-1/${slug}/feed`);
  if (response.status !== 200) {
    throw new Error(`feed answered ${response.status}`);
  }
  return { html: await response.text(), site, slug };
}

/** Internal state change of the first Work: Planned becomes In Progress. */
function startWorkA(fixtures: Fixtures) {
  fixtures.state.works[0] = workFact({ id: "work-a", status: "In Progress" });
}

const LATE_ITEMS = new Set(["work:work-new", "member:decision-late"]);

describe("Build in Public development feed", () => {
  test("lists only founder-approved records, never an unapproved one or the Roadmap itself", async () => {
    const fixtures = createFixtures({ members: [release, secretDoc] });
    await approveItems(fixtures, {
      keep: (item) => item.id !== "member:doc-secret",
    });
    const { html } = await feedHtml(fixtures);

    expect(html).toContain("Release 1.0");
    expect(html).not.toContain("Private strategy");
    expect(html).not.toContain("Never approved body");
    // A first publish is not a Roadmap dump: Works enter the feed only as later plan changes.
    expect(html).not.toContain("Internal work-a");
    expect(html).not.toContain("Entered Roadmap");
  });

  test("is not an automatic Project activity dump: source edits and unapproved items stay out until a new approval", async () => {
    const fixtures = createFixtures({ members: [release] });
    await approveItems(fixtures);
    const before = (await feedHtml(fixtures)).html;

    // The live Workspace moves on: a status change, a new Work and a new record.
    startWorkA(fixtures);
    fixtures.state.works.push(workFact({ id: "work-new", title: "Brand new" }));
    fixtures.state.members.push(
      memberFact({
        kind: "Decision",
        recordId: "decision-late",
        title: "Late",
      }),
    );
    expect((await feedHtml(fixtures)).html).toBe(before);

    // Approving only what existed records the one plan change, not the unapproved items.
    await approveItems(fixtures, { keep: (item) => !LATE_ITEMS.has(item.id) });
    const events = latest(fixtures).feed ?? [];
    expect(events.map((event) => event.eventId)).toEqual([
      "event-1",
      "event-2",
    ]);
    expect(JSON.stringify(events)).not.toMatch(/Brand new|Late/u);

    // Re-approving the same state changes nothing, so the feed gains no event.
    await approveItems(fixtures, { keep: (item) => !LATE_ITEMS.has(item.id) });
    expect(latest(fixtures).feed).toHaveLength(2);
  });

  test("reads the same approved revision as Roadmap, changelog and Proje view", async () => {
    const fixtures = createFixtures({ members: [release] });
    await approveItems(fixtures);
    startWorkA(fixtures);
    await approveItems(fixtures);

    const snapshot = latest(fixtures);
    const views = buildInPublicViews(snapshot, NOW);
    expect(views.feed.events).toEqual([...(snapshot.feed ?? [])].reverse());
    expect(views.approvedAt).toBe(snapshot.approvedAt);
    // Newest first, and the older event is still there.
    expect(views.feed.events.map((event) => event.eventId)).toEqual([
      "event-2",
      "event-1",
    ]);
  });

  test("never opens or names the private source record", async () => {
    const fixtures = createFixtures({ members: [release] });
    await approveItems(fixtures);
    startWorkA(fixtures);
    await approveItems(fixtures);
    const { html, slug } = await feedHtml(fixtures);

    // Selecting an item goes to this surface's own opaque snapshot entry only.
    expect(html).toContain(`href="/b/surface-1/${slug}/roadmap#work-1"`);
    expect(html).toContain(`href="/b/surface-1/${slug}#member-1"`);
    for (const secret of [
      "WORK-A",
      "release-1",
      "Not Started",
      "/projects/",
      "app.example",
    ]) {
      expect(html).not.toContain(secret);
    }
    const stored = JSON.stringify(latest(fixtures).feed);
    expect(stored).not.toContain("WORK-A");
    expect(stored).not.toContain("sourceWorkId");
    expect(stored).not.toContain("release-1");
  });

  test("shows no subscription, comment, vote or form, and answers GET only", async () => {
    const fixtures = createFixtures({ members: [release] });
    await approveItems(fixtures);
    startWorkA(fixtures);
    await approveItems(fixtures, { explanation: "We started earlier." });
    const { html, site, slug } = await feedHtml(fixtures);

    expect(html).not.toMatch(
      /subscribe|rss|atom|comment|vote|reply|views?:|<script|<form|<input|<textarea|mailto:/iu,
    );
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(
        (await site.routes.request(`/surface-1/${slug}/feed`, { method }))
          .status,
      ).toBe(404);
    }
  });

  test("answers an empty 410 Gone with noindex after unpublish, even through a warm cache", async () => {
    const fixtures = createFixtures({ members: [release] });
    await approveItems(fixtures);
    const { site, slug } = await feedHtml(fixtures);
    expect((await site.get(`/surface-1/${slug}/feed`)).status).toBe(200);

    await fixtures.access.unpublish(ACCOUNT_ID, PROJECT_ID);
    const gone = await site.get(`/surface-1/${slug}/feed`);
    expect(gone.status).toBe(410);
    expect(await gone.text()).toBe("");
    expect(gone.headers.get("x-robots-tag")).toContain("noindex");
  });

  test("is noindex by default", async () => {
    const fixtures = createFixtures({ members: [release] });
    await approveItems(fixtures);
    const { html, site, slug } = await feedHtml(fixtures);
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(
      (await site.get(`/surface-1/${slug}/feed`)).headers.get("x-robots-tag"),
    ).toBe("noindex, nofollow");
  });
});

describe("Build in Public Explain the change", () => {
  test("is offered with exact previous and new public values when a label changes", async () => {
    const fixtures = createFixtures();
    await approveItems(fixtures);
    expect((await previewOf(fixtures)).planChanges).toEqual([]);

    startWorkA(fixtures);
    const preview = await previewOf(fixtures);
    expect(preview.planChanges).toEqual([
      {
        from: "Planned",
        kind: "Label changed",
        memberId: "work-1",
        title: "Internal work-a",
        to: "In Progress",
      },
    ]);
  });

  test("is the founder's own text, bound to that publish event and shown with its values", async () => {
    const fixtures = createFixtures();
    await approveItems(fixtures);
    startWorkA(fixtures);
    await approveItems(fixtures, {
      explanation: "  Pulled forward because the pilot started early.  ",
    });

    const event = latest(fixtures).feed?.at(-1);
    expect(event?.explanation).toBe(
      "Pulled forward because the pilot started early.",
    );
    expect(event?.changes).toContainEqual(
      expect.objectContaining({
        from: "Planned",
        kind: "Label changed",
        to: "In Progress",
      }),
    );
    const { html } = await feedHtml(fixtures);
    expect(html).toContain("Pulled forward because the pilot started early.");
    expect(html).toContain("Planned to In Progress");
    // It is a note on the event, not a plan field: the Roadmap carries no explanation.
    expect(JSON.stringify(latest(fixtures).roadmap)).not.toContain("Pulled");
  });

  test("is optional and never generated: the same change publishes without it", async () => {
    const fixtures = createFixtures();
    await approveItems(fixtures);
    startWorkA(fixtures);
    await approveItems(fixtures);

    const event = latest(fixtures).feed?.at(-1);
    expect(event?.explanation).toBeNull();
    expect(event?.changes).toHaveLength(1);
    const { html } = await feedHtml(fixtures);
    expect(html).not.toContain("Founder note");

    // An empty or whitespace-only field is the same as none.
    fixtures.state.works[0] = workFact({ id: "work-a", status: "Not Started" });
    await approveItems(fixtures, { explanation: "   " });
    expect(latest(fixtures).feed?.at(-1)?.explanation).toBeNull();
  });

  test("is refused where the publish changes no plan reading, and is never stored", async () => {
    const fixtures = createFixtures({ members: [release] });
    // A first publish has no earlier plan to explain a difference from.
    await expect(
      approveItems(fixtures, { explanation: "Hello" }),
    ).rejects.toMatchObject({
      code: "BUILD_IN_PUBLIC_EXPLANATION_UNAVAILABLE",
    });
    expect(fixtures.revisions).toHaveLength(0);

    await approveItems(fixtures);
    await expect(
      approveItems(fixtures, { explanation: "Nothing changed" }),
    ).rejects.toBeInstanceOf(BuildInPublicError);
    expect(JSON.stringify(fixtures.revisions)).not.toContain("Nothing changed");
  });

  test("a changed shown date and a Roadmap exit are plan readings too", async () => {
    const fixtures = createFixtures({
      works: [
        workFact({ id: "work-a", targetDate: "2026-11-15" }),
        workFact({ id: "work-b" }),
      ],
    });
    await fixtures.access.setWorkCopy(ACCOUNT_ID, {
      dueDatePresentation: "Month",
      projectId: PROJECT_ID,
      publicStatusLabel: null,
      publicSummary: null,
      publicTitle: null,
      workId: "work-a",
    });
    await approveItems(fixtures);

    fixtures.state.works[0] = workFact({
      id: "work-a",
      targetDate: "2027-02-01",
    });
    const kinds = (await previewOf(fixtures)).planChanges.map(
      (change) => change.kind,
    );
    expect(kinds).toEqual(["Date changed"]);

    await approveItems(fixtures, {
      explanation: "Moved after the audit.",
      keep: (item) => item.id !== "work:work-b",
    });
    const changes = latest(fixtures).feed?.at(-1)?.changes ?? [];
    expect(changes).toContainEqual(
      expect.objectContaining({
        from: "November 2026",
        kind: "Date changed",
        to: "February 2027",
      }),
    );
    expect(changes).toContainEqual(
      expect.objectContaining({ kind: "Left Roadmap" }),
    );
  });
});
