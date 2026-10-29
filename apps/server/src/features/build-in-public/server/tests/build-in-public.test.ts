import {
  BUILD_IN_PUBLIC_STATUS_KEYS,
  type BuildInPublicPreview,
  publicStatusKeyOf,
  publicStatusLabelSchema,
  resolvePublicLabel,
} from "@cantiara/api/build-in-public";
import { describe, expect, test } from "vitest";

import {
  ACCOUNT_ID,
  createFixtures,
  PROJECT_ID,
  workFact,
} from "./build-in-public-fixtures";

type Fixtures = ReturnType<typeof createFixtures>;

async function enabled(fixtures: Fixtures) {
  await fixtures.access.setEnabled(ACCOUNT_ID, {
    enabled: true,
    projectId: PROJECT_ID,
  });
}

function item(preview: BuildInPublicPreview, id: string) {
  const found = preview.items.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`missing item ${id}`);
  }
  return found;
}

async function previewOf(fixtures: Fixtures, metadata?: { title?: string }) {
  const result = await fixtures.access.preview(ACCOUNT_ID, {
    metadata,
    projectId: PROJECT_ID,
  });
  if (!result) {
    throw new Error("no preview");
  }
  return result;
}

function approval(
  built: BuildInPublicPreview,
  approvedItemIds: string[],
  extra: { publishAnyway?: boolean } = {},
) {
  return {
    approval: {
      approvedItemIds,
      fingerprint: built.fingerprint,
      publishAnyway: extra.publishAnyway ?? false,
    },
    projectId: PROJECT_ID,
  };
}

describe("Build in Public status mapping matrix", () => {
  test("maps the internal state to the PRD default labels", () => {
    const label = (status: string, result: string | null = null) =>
      resolvePublicLabel({
        chosenLabel: null,
        projectMap: {},
        statusKey: publicStatusKeyOf(status, result),
      }).label;
    expect(label("Not Started")).toBe("Planned");
    expect(label("In Progress")).toBe("In Progress");
    expect(label("Closed", "Completed")).toBe("Completed");
    expect(label("Blocked")).toBeNull();
    expect(label("Closed", "Abandoned")).toBeNull();
    expect(BUILD_IN_PUBLIC_STATUS_KEYS).toHaveLength(5);
  });

  test("a label cannot reuse an internal status name", () => {
    for (const bad of ["Blocked", "Closed + Abandoned", "not started"]) {
      expect(publicStatusLabelSchema.safeParse(bad).success).toBe(false);
    }
    expect(publicStatusLabelSchema.safeParse("On hold").success).toBe(true);
  });
});

describe("Build in Public preview", () => {
  test("is per Project and optional: disabled until enabled, and approval is refused", async () => {
    const fixtures = createFixtures();
    expect(
      (await fixtures.access.settings(ACCOUNT_ID, PROJECT_ID))?.enabled,
    ).toBe(false);
    const built = await previewOf(fixtures);
    await expect(
      fixtures.access.approve(ACCOUNT_ID, approval(built, ["work:work-a"])),
    ).rejects.toMatchObject({ code: "BUILD_IN_PUBLIC_DISABLED" });
    expect(fixtures.revisions).toHaveLength(0);
  });

  test("an unowned Project has no settings and no preview", async () => {
    const { access } = createFixtures();
    expect(await access.settings("other", PROJECT_ID)).toBeNull();
    expect(await access.preview("other", { projectId: PROJECT_ID })).toBeNull();
  });

  test("writes nothing and shows every Roadmap Work as its own approval item", async () => {
    const fixtures = createFixtures();
    const built = await previewOf(fixtures);

    expect(built.written).toBe(false);
    expect(fixtures.revisions).toHaveLength(0);
    expect(
      built.items.filter((entry) => entry.kind === "Roadmap Work"),
    ).toHaveLength(3);
    expect(item(built, "work:work-a")).toMatchObject({
      change: "New",
      internalStatus: "Not Started",
      publicStatusLabel: "Planned",
    });
    expect(item(built, "work:work-b").publicStatusLabel).toBe("In Progress");
    expect(item(built, "work:work-c").publicStatusLabel).toBe("Completed");
  });

  test("Blocked and Closed + Abandoned are unpublishable until a label is chosen", async () => {
    const fixtures = createFixtures({
      works: [
        workFact({ id: "work-x", status: "Blocked" }),
        workFact({
          closureResult: "Abandoned",
          id: "work-y",
          status: "Closed",
        }),
      ],
    });
    await enabled(fixtures);
    const built = await previewOf(fixtures);
    expect(item(built, "work:work-x")).toMatchObject({
      blocker:
        "Choose a Public Status Label before this Work can be published.",
      publicStatusLabel: null,
    });
    expect(item(built, "work:work-y").blocker).not.toBeNull();
    await expect(
      fixtures.access.approve(
        ACCOUNT_ID,
        approval(built, ["work:work-x", "work:work-y"]),
      ),
    ).rejects.toMatchObject({ code: "BUILD_IN_PUBLIC_LABEL_REQUIRED" });
    expect(fixtures.revisions).toHaveLength(0);

    await fixtures.access.setWorkCopy(ACCOUNT_ID, {
      projectId: PROJECT_ID,
      publicStatusLabel: "On hold",
      publicSummary: null,
      publicTitle: null,
      workId: "work-x",
    });
    const next = await previewOf(fixtures);
    expect(item(next, "work:work-x")).toMatchObject({
      blocker: null,
      labelSource: "Chosen for this Work",
      publicStatusLabel: "On hold",
    });
    const result = await fixtures.access.approve(
      ACCOUNT_ID,
      approval(next, ["work:work-x"]),
    );
    expect(result?.revision).toBe(1);
  });

  test("a Project map override changes only the publication label", async () => {
    const fixtures = createFixtures({
      works: [workFact({ id: "work-x", status: "Blocked" })],
    });
    await fixtures.access.setStatusMap(ACCOUNT_ID, {
      label: "Waiting",
      projectId: PROJECT_ID,
      statusKey: "Blocked",
    });
    const built = await previewOf(fixtures);
    expect(item(built, "work:work-x")).toMatchObject({
      labelSource: "Project map",
      publicStatusLabel: "Waiting",
    });
    expect(fixtures.state.works[0]?.status).toBe("Blocked");
  });

  test("internal status changes never rewrite the approved label or the other way round", async () => {
    const fixtures = createFixtures({
      works: [workFact({ id: "work-a", status: "In Progress" })],
    });
    await enabled(fixtures);
    const first = await previewOf(fixtures);
    await fixtures.access.approve(ACCOUNT_ID, approval(first, ["work:work-a"]));
    expect(fixtures.revisions[0]?.roadmap[0]?.publicStatusLabel).toBe(
      "In Progress",
    );

    // The Kanban status moves; the approved snapshot does not.
    fixtures.state.works[0] = workFact({
      closureResult: "Completed",
      id: "work-a",
      status: "Closed",
    });
    expect(fixtures.revisions[0]?.roadmap[0]?.publicStatusLabel).toBe(
      "In Progress",
    );
    const next = await previewOf(fixtures);
    expect(item(next, "work:work-a")).toMatchObject({
      change: "Unpublished changes",
      diff: [
        {
          approved: "In Progress",
          field: "Public Status Label",
          proposed: "Completed",
        },
      ],
    });

    // Choosing a public label does not touch the internal status.
    await fixtures.access.setWorkCopy(ACCOUNT_ID, {
      projectId: PROJECT_ID,
      publicStatusLabel: "Shipped",
      publicSummary: null,
      publicTitle: null,
      workId: "work-a",
    });
    expect(fixtures.state.works[0]).toMatchObject({
      closureResult: "Completed",
      status: "Closed",
    });
  });

  test("Released is only suggested and applies only when its own item is approved", async () => {
    const fixtures = createFixtures({
      memberships: [{ releaseName: "v1.0", workId: "work-c" }],
    });
    await enabled(fixtures);
    const built = await previewOf(fixtures);
    const suggestion = item(built, "released:work-c");
    expect(suggestion).toMatchObject({
      kind: "Released label",
      parentId: "work:work-c",
      publicStatusLabel: "Released",
    });
    expect(item(built, "work:work-c").publicStatusLabel).toBe("Completed");

    await fixtures.access.approve(ACCOUNT_ID, approval(built, ["work:work-c"]));
    expect(fixtures.revisions[0]?.roadmap[0]?.publicStatusLabel).toBe(
      "Completed",
    );

    await fixtures.access.approve(
      ACCOUNT_ID,
      approval(await previewOf(fixtures), ["work:work-c", "released:work-c"]),
    );
    expect(fixtures.revisions[1]?.roadmap[0]?.publicStatusLabel).toBe(
      "Released",
    );
  });

  test("a dependent item never leaves without its approved Work", async () => {
    const fixtures = createFixtures({
      attachments: {
        "work-a": [{ id: "file-1", name: "plan.png", version: 3 }],
      },
      memberships: [{ releaseName: "v1.0", workId: "work-a" }],
      works: [
        workFact({
          description: "Intro\nhttps://youtu.be/dQw4w9WgXcQ\n",
          id: "work-a",
        }),
      ],
    });
    await enabled(fixtures);
    const built = await previewOf(fixtures);
    expect(item(built, "attachment:work-a:file-1").files).toEqual([
      { attachmentId: "file-1", name: "plan.png", version: 3 },
    ]);
    await expect(
      fixtures.access.approve(
        ACCOUNT_ID,
        approval(built, [
          "attachment:work-a:file-1",
          "released:work-a",
          "youtube:work-a:youtube:0",
        ]),
      ),
    ).rejects.toMatchObject({ code: "BUILD_IN_PUBLIC_NOTHING_APPROVED" });

    await fixtures.access.approve(
      ACCOUNT_ID,
      approval(built, ["work:work-a", "attachment:work-a:file-1"]),
    );
    const [entry] = fixtures.revisions[0]?.roadmap ?? [];
    expect(entry?.files).toEqual([
      { attachmentId: "file-1", name: "plan.png", version: 3 },
    ]);
    expect(entry?.embeds).toEqual([]);
    expect(entry?.publicStatusLabel).toBe("Planned");
  });

  test("a new File Attachment version needs approval; the old version stays", async () => {
    const fixtures = createFixtures({
      attachments: {
        "work-a": [{ id: "file-1", name: "plan.png", version: 1 }],
      },
      works: [workFact({ id: "work-a" })],
    });
    await enabled(fixtures);
    await fixtures.access.approve(
      ACCOUNT_ID,
      approval(await previewOf(fixtures), [
        "work:work-a",
        "attachment:work-a:file-1",
      ]),
    );
    fixtures.state.attachments["work-a"] = [
      { id: "file-1", name: "plan.png", version: 2 },
    ];
    const next = await previewOf(fixtures);
    expect(item(next, "attachment:work-a:file-1")).toMatchObject({
      change: "Unpublished changes",
      diff: [{ approved: "1", field: "File version", proposed: "2" }],
    });
    expect(fixtures.revisions[0]?.roadmap[0]?.files[0]?.version).toBe(1);
  });
});

describe("Build in Public public copy", () => {
  test("Public title and summary never auto-rewrite and mint no second Work", async () => {
    const fixtures = createFixtures({
      works: [workFact({ id: "work-a", title: "Secret codename" })],
    });
    await enabled(fixtures);
    await fixtures.access.setWorkCopy(ACCOUNT_ID, {
      projectId: PROJECT_ID,
      publicStatusLabel: null,
      publicSummary: "A faster board.",
      publicTitle: "Faster board",
      workId: "work-a",
    });
    const built = await previewOf(fixtures);
    expect(item(built, "work:work-a").fields).toEqual([
      { name: "Public title", value: "Faster board" },
      { name: "Public summary", value: "A faster board." },
      { name: "Roadmap horizon", value: "Now" },
    ]);
    await fixtures.access.approve(ACCOUNT_ID, approval(built, ["work:work-a"]));

    fixtures.state.works[0] = workFact({
      id: "work-a",
      title: "Renamed internally",
    });
    const next = await previewOf(fixtures);
    expect(item(next, "work:work-a").change).toBe("Unchanged");
    expect(fixtures.revisions[0]?.roadmap).toHaveLength(1);
    expect(fixtures.revisions[0]?.roadmap[0]).toMatchObject({
      summary: "A faster board.",
      title: "Faster board",
    });
  });

  test("without a Public title the internal title is previewed and diffed, never silently applied", async () => {
    const fixtures = createFixtures({
      works: [workFact({ id: "work-a", title: "Before" })],
    });
    await enabled(fixtures);
    await fixtures.access.approve(
      ACCOUNT_ID,
      approval(await previewOf(fixtures), ["work:work-a"]),
    );
    fixtures.state.works[0] = workFact({ id: "work-a", title: "After" });
    const next = await previewOf(fixtures);
    expect(item(next, "work:work-a").diff).toEqual([
      { approved: "Before", field: "Title", proposed: "After" },
    ]);
    expect(fixtures.revisions[0]?.roadmap[0]?.title).toBe("Before");
  });

  test("setWorkCopy only accepts a Roadmap Work of the Project", async () => {
    const { access } = createFixtures();
    expect(
      await access.setWorkCopy(ACCOUNT_ID, {
        projectId: PROJECT_ID,
        publicStatusLabel: null,
        publicSummary: null,
        publicTitle: "x",
        workId: "not-on-roadmap",
      }),
    ).toBeNull();
  });
});

describe("Build in Public placeholders and secrets", () => {
  test("lists unresolved placeholders with record, field and context; code is ignored", async () => {
    const fixtures = createFixtures({
      works: [workFact({ id: "work-a", title: "Hello {{customer_name}} ok" })],
    });
    await enabled(fixtures);
    await fixtures.access.setWorkCopy(ACCOUNT_ID, {
      projectId: PROJECT_ID,
      publicStatusLabel: null,
      publicSummary: "Use `{{in_code}}` here\n```\n{{in_fence}}\n```",
      publicTitle: null,
      workId: "work-a",
    });
    const built = await previewOf(fixtures);
    expect(built.placeholders).toHaveLength(1);
    expect(built.placeholders[0]).toMatchObject({
      field: "Title",
      itemId: "work:work-a",
      name: "customer_name",
      sourceRecord: { id: "work-a", type: "Work" },
    });
    expect(built.placeholders[0]?.context).toContain("{{customer_name}}");
  });

  test("scope approval does not consume the warning; Publish/share anyway does", async () => {
    const fixtures = createFixtures({
      works: [workFact({ id: "work-a", title: "Hi {{name}}" })],
    });
    await enabled(fixtures);
    const built = await previewOf(fixtures);
    await expect(
      fixtures.access.approve(ACCOUNT_ID, approval(built, ["work:work-a"])),
    ).rejects.toMatchObject({
      code: "BUILD_IN_PUBLIC_PLACEHOLDERS_UNRESOLVED",
    });
    const result = await fixtures.access.approve(
      ACCOUNT_ID,
      approval(built, ["work:work-a"], { publishAnyway: true }),
    );
    expect(result?.revision).toBe(1);
  });

  test("a placeholder in an unapproved item does not block the approved ones", async () => {
    const fixtures = createFixtures({
      works: [
        workFact({ id: "work-a" }),
        workFact({ id: "work-b", title: "Hi {{name}}" }),
      ],
    });
    await enabled(fixtures);
    const built = await previewOf(fixtures);
    const result = await fixtures.access.approve(
      ACCOUNT_ID,
      approval(built, ["work:work-a"]),
    );
    expect(result?.revision).toBe(1);
  });

  test("metadata is its own item, diffed and placeholder-checked", async () => {
    const fixtures = createFixtures();
    await enabled(fixtures);
    const built = await previewOf(fixtures, { title: "Hello {{who}}" });
    expect(item(built, "metadata")).toMatchObject({
      kind: "Metadata",
      fields: [{ name: "Publication title", value: "Hello {{who}}" }],
    });
    expect(built.placeholders[0]).toMatchObject({
      field: "Publication title",
      itemId: "metadata",
    });
  });

  test("neither Secret-like content nor internal status names reach the snapshot", async () => {
    const fixtures = createFixtures({
      works: [
        workFact({
          description: "token=ghp_supersecret password: hunter2",
          id: "work-a",
          status: "Blocked",
        }),
      ],
    });
    await enabled(fixtures);
    await fixtures.access.setWorkCopy(ACCOUNT_ID, {
      projectId: PROJECT_ID,
      publicStatusLabel: "On hold",
      publicSummary: null,
      publicTitle: "Board",
      workId: "work-a",
    });
    const built = await previewOf(fixtures);
    await fixtures.access.approve(ACCOUNT_ID, approval(built, ["work:work-a"]));
    const published = JSON.stringify(fixtures.revisions[0]);
    for (const leaked of [
      "ghp_supersecret",
      "hunter2",
      "Blocked",
      "Not Started",
      "Abandoned",
      "Closed",
    ]) {
      expect(published).not.toContain(leaked);
    }
  });
});

describe("Build in Public approval", () => {
  test("a changed preview is stale and approves nothing", async () => {
    const fixtures = createFixtures();
    await enabled(fixtures);
    const built = await previewOf(fixtures);
    fixtures.state.works[0] = workFact({ id: "work-a", title: "Edited" });
    await expect(
      fixtures.access.approve(ACCOUNT_ID, approval(built, ["work:work-a"])),
    ).rejects.toMatchObject({ code: "BUILD_IN_PUBLIC_PREVIEW_STALE" });
    expect(fixtures.revisions).toHaveLength(0);
  });

  test("a retried approval is stale and appends no second revision or feed event", async () => {
    const fixtures = createFixtures();
    await enabled(fixtures);
    const request = approval(await previewOf(fixtures), ["work:work-a"]);
    await fixtures.access.approve(ACCOUNT_ID, request);
    await expect(
      fixtures.access.approve(ACCOUNT_ID, request),
    ).rejects.toMatchObject({ code: "BUILD_IN_PUBLIC_PREVIEW_STALE" });
    expect(fixtures.revisions).toHaveLength(1);
  });

  test("only approved items leave, with stable opaque ids across revisions", async () => {
    const fixtures = createFixtures();
    await enabled(fixtures);
    await fixtures.access.approve(
      ACCOUNT_ID,
      approval(await previewOf(fixtures), ["work:work-b"]),
    );
    await fixtures.access.approve(
      ACCOUNT_ID,
      approval(await previewOf(fixtures), ["work:work-a", "work:work-b"]),
    );
    expect(
      fixtures.revisions[0]?.roadmap.map((entry) => entry.memberId),
    ).toEqual(["work-1"]);
    const second = fixtures.revisions[1]?.roadmap ?? [];
    expect(
      second.find((entry) => entry.sourceWorkId === "work-b")?.memberId,
    ).toBe("work-1");
    expect(
      second.find((entry) => entry.sourceWorkId === "work-a")?.memberId,
    ).toBe("work-2");
    expect(second.some((entry) => entry.sourceWorkId === "work-c")).toBe(false);
  });

  test("approving nothing is refused", async () => {
    const fixtures = createFixtures();
    await enabled(fixtures);
    await expect(
      fixtures.access.approve(
        ACCOUNT_ID,
        approval(await previewOf(fixtures), []),
      ),
    ).rejects.toMatchObject({ code: "BUILD_IN_PUBLIC_NOTHING_APPROVED" });
  });
});
