// biome-ignore-all lint/performance/useTopLevelRegex: assertions read clearer with inline patterns.
// biome-ignore-all lint/performance/noAwaitInLoops: requests are checked one after another on purpose.

import {
  BuildInPublicError,
  presentDueDate,
} from "@cantiara/api/build-in-public";
import { buildInPublicViews } from "@cantiara/api/build-in-public-publication";
import { describe, expect, test } from "vitest";

import type { BuildInPublicSourceMember } from "../build-in-public-project-view";
import {
  ACCOUNT_ID,
  approveItems,
  createFixtures,
  createPublicSite,
  enable,
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
const decision = memberFact({
  date: "2026-08-15",
  fields: [{ name: "Decision", value: "Ship weekly" }],
  kind: "Decision",
  recordId: "decision-1",
  title: "Ship cadence",
});
const secretDoc = memberFact({
  fields: [{ name: "Body", value: "Never approved body" }],
  recordId: "doc-secret",
  title: "Private strategy",
});

const wall: BuildInPublicSourceMember = memberFact({
  kind: "Project Wall",
  recordId: "wall-1",
  title: "Launch wall",
  wall: {
    cards: [
      {
        color: "blue",
        groupId: "g1",
        id: "c1",
        title: "Public card",
        x: 100,
        y: 50,
      },
      {
        color: null,
        groupId: "g1",
        id: "c2",
        title: "Private card",
        x: 900,
        y: 700,
      },
      {
        color: null,
        groupId: null,
        id: "c3",
        title: "Third card",
        x: 300,
        y: 50,
      },
    ],
    files: [
      {
        attachmentId: "att-1",
        cardId: "c1",
        markup: "Arrow on the logo",
        name: "logo.png",
        version: 3,
      },
    ],
    focusOrder: ["c2", "c1", "c3"],
    groups: [{ id: "g1", title: "Core" }],
    lines: [
      { fromCardId: "c1", id: "l1", label: "depends", toCardId: "c2" },
      { fromCardId: "c1", id: "l2", label: "ships", toCardId: "c3" },
    ],
    liveBlocks: [
      {
        id: "b1",
        records: [
          { fields: [{ name: "Status", value: "Open" }], title: "Bug A" },
        ],
        sourceLabel: "Open bugs",
      },
    ],
    narrative: "Why this wall exists",
  },
});

function snapshotOf(fixtures: ReturnType<typeof createFixtures>) {
  const snapshot = fixtures.surfaces[0]?.revisions.at(-1);
  if (!snapshot) {
    throw new Error("no snapshot");
  }
  return snapshot;
}

describe("Build in Public same-revision trio", () => {
  test("Roadmap, changelog and Proje view are projections of one approved revision", async () => {
    const fixtures = createFixtures({
      members: [release, decision, secretDoc],
    });
    await approveItems(fixtures, {
      keep: (item) => item.id !== "member:doc-secret",
    });
    const site = createPublicSite(fixtures);
    const slug = fixtures.surfaces[0]?.slugs.canonical ?? "";
    const base = `/surface-1/${slug}`;

    const [project, roadmap, changelog] = await Promise.all([
      site.get(base).then((r) => r.text()),
      site.get(`${base}/roadmap`).then((r) => r.text()),
      site.get(`${base}/changelog`).then((r) => r.text()),
    ]);

    expect(roadmap).toContain("Internal work-a");
    expect(changelog).toContain("Release 1.0");
    expect(changelog).toContain("Ship cadence");
    expect(project).toContain("Release 1.0");
    // The unapproved record is nowhere on any of the three views.
    for (const html of [project, roadmap, changelog]) {
      expect(html).not.toContain("Private strategy");
      expect(html).not.toContain("Never approved body");
    }
    // One snapshot object feeds all three projections.
    const views = buildInPublicViews(snapshotOf(fixtures), NOW);
    expect(views.changelog.entries.map((e) => e.title)).toEqual([
      "Release 1.0",
      "Ship cadence",
    ]);
    expect(views.roadmap.horizons[0]?.works).toHaveLength(3);
  });

  test("a source write is Unpublished changes and public only after a new approval", async () => {
    const fixtures = createFixtures({ members: [release] });
    await approveItems(fixtures);
    const site = createPublicSite(fixtures);
    const slug = fixtures.surfaces[0]?.slugs.canonical ?? "";
    const base = `/surface-1/${slug}`;

    fixtures.state.works[0] = workFact({
      id: "work-a",
      title: "Renamed after approval",
    });
    fixtures.state.members[0] = { ...release, title: "Release 1.0 renamed" };

    const preview = await previewOf(fixtures);
    const changed = preview.items.filter(
      (item) => item.change === "Unpublished changes",
    );
    expect(changed.map((item) => item.id).sort()).toEqual([
      "member:release-1",
      "work:work-a",
    ]);
    const publication = await fixtures.access.publication(
      ACCOUNT_ID,
      PROJECT_ID,
    );
    expect(publication?.unpublishedChanges).toBe(true);
    const before = await (await site.get(`${base}/changelog`)).text();
    expect(before).toContain("Release 1.0");
    expect(before).not.toContain("renamed");
    expect(fixtures.surfaces[0]?.revisions).toHaveLength(1);

    await approveItems(fixtures);
    const after = await (await site.get(`${base}/changelog`)).text();
    expect(after).toContain("Release 1.0 renamed");
    expect(fixtures.surfaces[0]?.revisions).toHaveLength(2);
  });

  test("a visitor request never queries the live Workspace", async () => {
    const fixtures = createFixtures({ members: [release] });
    await approveItems(fixtures);
    const reads = fixtures.workspaceReads.count;
    const site = createPublicSite(fixtures);
    const slug = fixtures.surfaces[0]?.slugs.canonical ?? "";

    for (const path of ["", "/roadmap", "/changelog"]) {
      const response = await site.get(`/surface-1/${slug}${path}`);
      expect(response.status).toBe(200);
    }

    expect(fixtures.workspaceReads.count).toBe(reads);
  });
});

describe("Build in Public selected Project Wall", () => {
  test("lists every part as its own approval item and keeps private structure out", async () => {
    const fixtures = createFixtures({ members: [wall] });
    await enable(fixtures);
    const preview = await previewOf(fixtures);
    const parts = preview.items.filter((item) => item.kind === "Wall part");

    expect(new Set(parts.map((item) => item.wallPart))).toEqual(
      new Set([
        "Card",
        "Layout",
        "Group",
        "View text",
        "Visual line",
        "Focus order",
        "Color",
        "File version",
        "Crop, rotate and markup",
        "Live collection block",
      ]),
    );
    expect(parts.every((item) => item.parentId === "member:wall-1")).toBe(true);
    const live = parts.find(
      (item) => item.wallPart === "Live collection block",
    );
    expect(live?.title).toContain("snapshot of 2026-10-29, read-only");

    await approveItems(fixtures, {
      keep: (item) => item.id !== "wall:wall-1:Card:c2",
    });
    const stored = snapshotOf(fixtures).members?.[0]?.wall;
    const json = JSON.stringify(stored);

    expect(json).not.toContain("Private card");
    expect(stored?.cards.map((card) => card.title)).toEqual([
      "Public card",
      "Third card",
    ]);
    // The line to the private card, and its focus step, are gone with it.
    expect(stored?.lines.map((line) => line.label)).toEqual(["ships"]);
    expect(stored?.focusOrder).toHaveLength(2);
    // Ranks over the approved cards only: no gap hints at a private card.
    expect(stored?.cards.map((card) => [card.column, card.row])).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(stored?.liveBlocks[0]?.frozenOn).toBe("2026-10-29");
    expect(stored?.files[0]).toMatchObject({ name: "logo.png", version: 3 });
  });

  test("an unticked Wall part does not leave and a part cannot leave without its Wall", async () => {
    const fixtures = createFixtures({ members: [wall] });
    await expect(
      approveItems(fixtures, {
        keep: (item) =>
          item.id === "wall:wall-1:Card:c1" ||
          item.id === "wall:wall-1:Live collection block:b1",
      }),
    ).rejects.toBeInstanceOf(BuildInPublicError);
    // Parts of an unapproved Wall alone approve nothing.
    expect(fixtures.surfaces).toHaveLength(0);

    await approveItems(fixtures, {
      keep: (item) =>
        item.id === "member:wall-1" || item.id === "wall:wall-1:Card:c1",
    });
    const stored = snapshotOf(fixtures).members?.[0]?.wall;
    expect(stored?.liveBlocks).toHaveLength(0);
    expect(stored?.lines).toHaveLength(0);
    // A group nobody approved is not listed, even though an approved card sat in it.
    expect(stored?.groups).toHaveLength(0);
    expect(stored?.cards[0]?.groupId).toBeNull();
  });
});

describe("Build in Public featured record", () => {
  const future = "2026-12-01T00:00:00.000Z";

  test("is off by default", async () => {
    const fixtures = createFixtures({ members: [release, decision] });
    await approveItems(fixtures);
    expect(snapshotOf(fixtures).featured).toBeNull();
  });

  test("keeps one approved Release or Decision on top until the window ends, then chronological", async () => {
    const fixtures = createFixtures({ members: [release, decision] });
    await approveItems(fixtures);
    const writesBefore = fixtures.writes.length;
    await approveItems(fixtures, {
      featured: { endsAt: future, recordId: "decision-1" },
    });
    // Featuring publishes nothing extra and emits no signal: one revision write.
    expect(fixtures.writes.slice(writesBefore)).toEqual(["publish"]);

    const slug = fixtures.surfaces[0]?.slugs.canonical ?? "";
    const open = createPublicSite(fixtures);
    const during = await (await open.get(`/surface-1/${slug}`)).text();
    expect(during).toContain('class="featured"');
    expect(during.indexOf("Ship cadence")).toBeLessThan(
      during.indexOf("Release 1.0"),
    );

    const later = createPublicSite(fixtures, {
      now: () => new Date("2027-01-01T00:00:00.000Z"),
    });
    const after = await (await later.get(`/surface-1/${slug}`)).text();
    expect(after).not.toContain('class="featured"');
    expect(after.indexOf("Release 1.0")).toBeLessThan(
      after.indexOf("Ship cadence"),
    );
  });

  test("refuses a second record, a non-Release/Decision, an unapproved record and a past end", async () => {
    const fixtures = createFixtures({
      members: [release, decision, secretDoc],
    });
    const attempt = (
      request: { endsAt: string; recordId: string },
      keep?: (item: { id: string }) => boolean,
    ) => approveItems(fixtures, { featured: request, keep });

    // A record first approved in this very snapshot cannot be featured yet.
    await expect(
      attempt({ endsAt: future, recordId: "decision-1" }),
    ).rejects.toMatchObject({ code: "BUILD_IN_PUBLIC_FEATURED_INVALID" });
    expect(fixtures.surfaces).toHaveLength(0);
    await approveItems(fixtures, {
      keep: (item) => item.id !== "member:doc-secret",
    });

    await expect(
      attempt({ endsAt: future, recordId: "doc-secret" }),
    ).rejects.toMatchObject({ code: "BUILD_IN_PUBLIC_FEATURED_INVALID" });
    await expect(
      attempt({ endsAt: "2026-01-01T00:00:00.000Z", recordId: "decision-1" }),
    ).rejects.toMatchObject({ code: "BUILD_IN_PUBLIC_FEATURED_INVALID" });
    await expect(
      attempt(
        { endsAt: future, recordId: "decision-1" },
        (item) => item.id !== "member:decision-1",
      ),
    ).rejects.toMatchObject({ code: "BUILD_IN_PUBLIC_FEATURED_INVALID" });

    // Featuring another record replaces the first: never more than one.
    await attempt({ endsAt: future, recordId: "decision-1" });
    await attempt({ endsAt: future, recordId: "release-1" });
    const { featured } = snapshotOf(fixtures);
    expect(featured).toMatchObject({ endsAt: future });
    expect(
      snapshotOf(fixtures).members?.find(
        (member) => member.memberId === featured?.memberId,
      )?.title,
    ).toBe("Release 1.0");
  });
});

describe("Build in Public due-date presentation", () => {
  test("derives Full date, Month, Quarter and Hidden from the internal date", () => {
    expect(presentDueDate("2026-11-15", "Full date")).toBe("15 November 2026");
    expect(presentDueDate("2026-11-15", "Month")).toBe("November 2026");
    expect(presentDueDate("2026-11-15", "Quarter")).toBe("Q4 2026");
    expect(presentDueDate("2026-11-15", "Hidden")).toBeNull();
    expect(presentDueDate(null, "Month")).toBeNull();
  });

  test("a coarser presentation never carries the finer date, and a date edit is Unpublished changes", async () => {
    const fixtures = createFixtures({
      works: [workFact({ id: "work-a", targetDate: "2026-11-15" })],
    });
    await fixtures.access.setWorkCopy(ACCOUNT_ID, {
      dueDatePresentation: "Quarter",
      projectId: PROJECT_ID,
      publicStatusLabel: null,
      publicSummary: null,
      publicTitle: null,
      workId: "work-a",
    });
    await approveItems(fixtures);
    const snapshot = JSON.stringify(snapshotOf(fixtures));
    expect(snapshot).toContain("Q4 2026");
    expect(snapshot).not.toContain("2026-11-15");
    expect(snapshot).not.toContain("15 November");

    fixtures.state.works[0] = workFact({
      id: "work-a",
      targetDate: "2027-02-01",
    });
    const item = (await previewOf(fixtures)).items.find(
      (entry) => entry.id === "work:work-a",
    );
    expect(item?.change).toBe("Unpublished changes");
    expect(item?.diff).toContainEqual({
      approved: "Q4 2026",
      field: "Due date",
      proposed: "Q1 2027",
    });
  });

  test("Hidden is the default and shows no date", async () => {
    const fixtures = createFixtures({
      works: [workFact({ id: "work-a", targetDate: "2026-11-15" })],
    });
    await approveItems(fixtures);
    expect(snapshotOf(fixtures).roadmap[0]?.dueLabel).toBeNull();
  });
});

describe("Build in Public surface metadata", () => {
  test("Proje, Roadmap index and changelog index keep their own title and summary", async () => {
    const fixtures = createFixtures({ members: [release] });
    await approveItems(fixtures, {
      metadata: {
        changelogIndex: { summary: "All releases", title: "Release log" },
        roadmapIndex: { title: "What is next" },
        summary: "A public project",
        title: "My Project",
      },
    });
    const slug = fixtures.surfaces[0]?.slugs.canonical ?? "";
    const site = createPublicSite(fixtures);
    const read = async (path: string) =>
      (await site.get(`/surface-1/${slug}${path}`)).text();

    const [project, roadmap, changelog] = [
      await read(""),
      await read("/roadmap"),
      await read("/changelog"),
    ];
    expect(project).toContain("<h1>My Project</h1>");
    expect(roadmap).toContain("<h1>What is next</h1>");
    expect(roadmap).not.toContain("A public project");
    expect(changelog).toContain("<h1>Release log</h1>");
    expect(changelog).toContain("All releases");
    expect(changelog).not.toContain("My Project</h1>");
  });
});

describe("Build in Public has no counters or visitor identity", () => {
  test("neither the snapshot nor the page carries a counter, last access or analytics", async () => {
    const fixtures = createFixtures({ members: [release] });
    await approveItems(fixtures);
    const slug = fixtures.surfaces[0]?.slugs.canonical ?? "";
    const html = await (
      await createPublicSite(fixtures).get(`/surface-1/${slug}`)
    ).text();

    expect(JSON.stringify(snapshotOf(fixtures))).not.toMatch(
      /views?Count|lastAccess|visitor|analytics|counter/iu,
    );
    expect(html.toLowerCase()).not.toMatch(
      /views?:|visitors?|last access|analytics|comment|subscribe|vote|<script|<form|<input/u,
    );
  });
});

describe("Build in Public first-content budget", () => {
  test("a small and an adversarial snapshot render within a measured server-side bound", async () => {
    const small = createFixtures({ members: [release] });
    await approveItems(small);

    const manyWorks = Array.from({ length: 3000 }, (_, index) =>
      workFact({
        description: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        id: `work-${index}`,
        title: `<script>alert(${index})</script> ${"x".repeat(200)}`,
      }),
    );
    const manyMembers = Array.from({ length: 1500 }, (_, index) =>
      memberFact({
        date: `2026-0${(index % 9) + 1}-01`,
        fields: [{ name: "Body", value: "y".repeat(5000) }],
        kind: index % 2 === 0 ? "Decision" : "Project Release",
        recordId: `rec-${index}`,
      }),
    );
    const adversarial = createFixtures({
      members: [...manyMembers, wall],
      works: manyWorks,
    });
    await approveItems(adversarial);

    for (const fixtures of [small, adversarial]) {
      const slug = fixtures.surfaces[0]?.slugs.canonical ?? "";
      // Cold cache each time: this measures the render, not a cache hit.
      for (const path of ["", "/roadmap", "/changelog"]) {
        const site = createPublicSite(fixtures);
        const started = performance.now();
        const response = await site.get(`/surface-1/${slug}${path}`);
        const html = await response.text();
        const elapsed = performance.now() - started;

        expect(response.status).toBe(200);
        // The PRD 15 budget is 2500 ms p95 for the whole visit; the server-side
        // render must use a small fraction of it. The browser and mobile lab
        // matrix is not run here.
        expect(elapsed).toBeLessThan(500);
        // Long lists page instead of growing the first response.
        expect(html.length).toBeLessThan(2_000_000);
        expect(html).not.toContain("<script>alert");
        // No third-party request exists before a click.
        expect(html).not.toMatch(/<iframe|<img|<link|<script[^>]*src=/u);
      }
    }
  });
});
