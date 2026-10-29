import {
  LinkSharingConflictError,
  LinkSharingPlaceholdersError,
  LinkSharingScopeError,
  type ShareRoot,
  type ShareScopePreview,
} from "@cantiara/api/link-sharing";
import { describe, expect, test } from "vitest";

import {
  createLinkSharing,
  type ShareSource,
  type ShareSourceRecord,
} from "../link-sharing";
import { createMemoryLinkSharing } from "../link-sharing-memory-store";

const ACCOUNT = "account-1";
const PROJECT = "project-1";
const DOC: ShareRoot = { id: "d1", kind: "Document" };

const workRecord = (
  id: string,
  title: string,
  status: string,
  horizon: string | null = "Now",
): ShareSourceRecord => ({
  fields: [
    { key: "status", kind: "status", label: "Status", value: status },
    {
      key: "description",
      kind: "description",
      label: "Description",
      value: `About ${title}`,
    },
    {
      key: "roadmapHorizon",
      kind: "roadmap-horizon",
      label: "Roadmap horizon",
      value: horizon,
    },
  ],
  id,
  kind: "Work",
  parts: [],
  title,
});

function documentSource(
  overrides: Partial<ShareSourceRecord> = {},
): ShareSource {
  return {
    blockers: [],
    members: [],
    projectId: PROJECT,
    record: {
      fields: [
        { key: "body", kind: "markdown", label: "Body", value: "Hello world" },
        {
          key: "apiKey",
          kind: "secret",
          label: "API key",
          value: "sk-live-123",
        },
        {
          key: "shareToken",
          kind: "share-token",
          label: "Share token",
          value: "tok-abc",
        },
        {
          key: "linkPassword",
          kind: "link-password",
          label: "Link password",
          value: "hunter2",
        },
      ],
      id: "d1",
      kind: "Document",
      parts: [
        {
          detail: "v2 · report.pdf",
          id: "att1",
          kind: "Attachment",
          label: "report.pdf",
        },
        {
          detail: "Related",
          id: "rel1",
          kind: "Relation",
          label: "Related: Private work",
          target: { id: "w-private", kind: "Work" },
        },
      ],
      title: "Launch plan",
      ...overrides,
    },
  };
}

function setup(source: ShareSource = documentSource(), root = DOC) {
  const harness = createMemoryLinkSharing({
    accountId: ACCOUNT,
    sources: [{ root, source }],
  });
  let tick = 0;
  const next = () => {
    tick += 1;
    return tick - 1;
  };
  const access = createLinkSharing(harness.store, {
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, next())),
  });
  return { access, harness, root };
}

const idsOf = (preview: ShareScopePreview, predicate = (_: unknown) => true) =>
  preview.items.filter(predicate).map((item) => item.itemId);

async function previewOf(
  access: ReturnType<typeof setup>["access"],
  root: ShareRoot,
) {
  const preview = await access.preview(ACCOUNT, { root });
  if (!preview) {
    throw new Error("no preview");
  }
  return preview;
}

/** Everything selectable except candidates, as the form defaults. */
const defaultSelection = (preview: ShareScopePreview) =>
  idsOf(
    preview,
    (item) =>
      (item as ShareScopePreview["items"][number]).selectable &&
      !(item as ShareScopePreview["items"][number]).candidate,
  );

describe("Link Sharing preview", () => {
  test("lists the exact record, fields and parts of the root before any approval", async () => {
    const { access, root } = setup();
    const preview = await previewOf(access, root);
    expect(preview.root).toEqual({
      id: "d1",
      kind: "Document",
      title: "Launch plan",
    });
    expect(preview.surface).toBeNull();
    expect(preview.items.map((item) => `${item.kind}:${item.label}`)).toEqual([
      "Record:Document: Launch plan",
      "Field:Title",
      "Field:Body",
      "Attachment:report.pdf",
      "Relation:Related: Private work",
    ]);
  });

  test("keeps Secret, share token and link password out of the preview", async () => {
    const { access, root } = setup();
    const preview = await previewOf(access, root);
    const text = JSON.stringify(preview);
    for (const secret of ["sk-live-123", "tok-abc", "hunter2", "API key"]) {
      expect(text).not.toContain(secret);
    }
  });

  test("does not inherit scope: unrelated records, a relation target and dropped kinds stay out", async () => {
    const source = documentSource();
    source.members = [
      {
        matchesFilter: () => true,
        record: {
          fields: [],
          id: "inbox-1",
          kind: "Capture Inbox Item",
          parts: [],
          title: "Raw capture",
        },
      },
    ];
    const { access, root } = setup(source);
    const preview = await previewOf(access, root);
    expect(preview.items.filter((item) => item.kind === "Record")).toHaveLength(
      1,
    );
    expect(JSON.stringify(preview)).not.toContain("Raw capture");
    const relation = preview.items.find((item) => item.kind === "Relation");
    expect(relation?.selectable).toBe(false);
  });

  test("refuses to approve a relation whose other end is not in scope", async () => {
    const { access, root } = setup();
    const preview = await previewOf(access, root);
    await expect(
      access.approve(ACCOUNT, {
        approvalId: "a1",
        approvedItemIds: idsOf(preview),
        liveItemIds: [],
        publishAnyway: false,
        root,
      }),
    ).rejects.toBeInstanceOf(LinkSharingScopeError);
  });

  test("returns null for a root the account does not own", async () => {
    const { access, root } = setup();
    expect(await access.preview("other", { root })).toBeNull();
    expect(
      await access.approve("other", {
        approvalId: "a1",
        approvedItemIds: [],
        liveItemIds: [],
        publishAnyway: false,
        root,
      }),
    ).toBeNull();
  });

  test("requires an exact version for a Screen and blocks when none exists", async () => {
    const screen: ShareRoot = { id: "s1", kind: "Screen" };
    const source: ShareSource = {
      blockers: [],
      members: [],
      projectId: PROJECT,
      record: {
        fields: [],
        id: "s1",
        kind: "Screen",
        parts: [1, 2].map((n) => ({
          detail: null,
          group: "Wireframe version",
          id: `v${n}`,
          kind: "Version" as const,
          label: `Wireframe version ${n}`,
        })),
        title: "Home",
      },
    };
    const { access } = setup(source, screen);
    const preview = await previewOf(access, screen);
    const base = {
      approvalId: "a1",
      liveItemIds: [],
      publishAnyway: false,
      root: screen,
    };
    const record = "record:Screen:s1";
    const none = [record, "field:Screen:s1:title"];
    await expect(
      access.approve(ACCOUNT, { ...base, approvedItemIds: none }),
    ).rejects.toThrow("Choose exactly one Wireframe version");
    await expect(
      access.approve(ACCOUNT, {
        ...base,
        approvedItemIds: [...none, "part:Screen:s1:v1", "part:Screen:s1:v2"],
      }),
    ).rejects.toThrow("Choose exactly one Wireframe version");
    const approved = await access.approve(ACCOUNT, {
      ...base,
      approvedItemIds: [...none, "part:Screen:s1:v2"],
    });
    expect(approved?.revision).toBe(1);
    expect(
      preview.items.some((item) => item.group === "Wireframe version"),
    ).toBe(true);

    const blocked = setup(
      { ...source, blockers: ["Save a Wireframe version first."] },
      screen,
    );
    await expect(
      blocked.access.approve(ACCOUNT, { ...base, approvedItemIds: none }),
    ).rejects.toThrow("Save a Wireframe version first.");
  });
});

describe("Link Sharing approval", () => {
  test("mints nothing until approved, then creates one surface with revision 1", async () => {
    const { access, harness, root } = setup();
    const preview = await previewOf(access, root);
    expect(harness.surfaces).toHaveLength(0);
    const selection = defaultSelection(preview).filter(
      (id) => !id.startsWith("part:Document:d1:rel1"),
    );
    const approved = await access.approve(ACCOUNT, {
      approvalId: "a1",
      approvedItemIds: selection,
      liveItemIds: [],
      publishAnyway: false,
      root,
    });
    expect(approved).toMatchObject({ label: "Approved snapshot", revision: 1 });
    expect(harness.surfaces).toHaveLength(1);
    expect(
      harness.surfaces[0]?.manifest.items.map((item) => item.itemId),
    ).toEqual(selection);
  });

  test("approves nothing by default and cannot approve an item the preview never listed", async () => {
    const { access, root } = setup();
    await expect(
      access.approve(ACCOUNT, {
        approvalId: "a1",
        approvedItemIds: ["record:Document:d1", "record:Work:w-private"],
        liveItemIds: [],
        publishAnyway: false,
        root,
      }),
    ).rejects.toBeInstanceOf(LinkSharingScopeError);
    await expect(
      access.approve(ACCOUNT, {
        approvalId: "a2",
        approvedItemIds: [],
        liveItemIds: [],
        publishAnyway: false,
        root,
      }),
    ).rejects.toThrow("The shared record must be approved.");
  });

  test("keeps Secret, token and password out of the stored manifest", async () => {
    const { access, harness, root } = setup();
    const preview = await previewOf(access, root);
    await access.approve(ACCOUNT, {
      approvalId: "a1",
      approvedItemIds: defaultSelection(preview).filter(
        (id) => !id.includes("rel1"),
      ),
      liveItemIds: [],
      publishAnyway: false,
      root,
    });
    const stored = JSON.stringify(harness.surfaces[0]?.manifest);
    for (const secret of ["sk-live-123", "tok-abc", "hunter2"]) {
      expect(stored).not.toContain(secret);
    }
  });

  test("a later source write stays private and the previous revision is immutable", async () => {
    const { access, harness, root } = setup();
    const first = await previewOf(access, root);
    const selection = defaultSelection(first).filter(
      (id) => !id.includes("rel1"),
    );
    await access.approve(ACCOUNT, {
      approvalId: "a1",
      approvedItemIds: selection,
      liveItemIds: [],
      publishAnyway: false,
      root,
    });
    const frozen = JSON.stringify(harness.revisions[0]?.manifest);
    harness.setSource(
      root,
      documentSource({
        fields: [
          {
            key: "body",
            kind: "markdown",
            label: "Body",
            value: "Edited later",
          },
        ],
      }),
    );
    expect(JSON.stringify(harness.surfaces[0]?.manifest)).not.toContain(
      "Edited later",
    );
    const second = await previewOf(access, root);
    expect(second.diff?.changed).toContain("field:Document:d1:body");
    expect(
      second.items.find((item) => item.itemId === "field:Document:d1:body")
        ?.state,
    ).toBe("Changed since approval");
    const approved = await access.approve(ACCOUNT, {
      approvalId: "a2",
      approvedItemIds: [
        "record:Document:d1",
        "field:Document:d1:title",
        "field:Document:d1:body",
      ],
      liveItemIds: [],
      publishAnyway: false,
      root,
    });
    expect(approved?.revision).toBe(2);
    expect(harness.surfaces).toHaveLength(1);
    expect(JSON.stringify(harness.revisions[0]?.manifest)).toBe(frozen);
    expect(JSON.stringify(harness.surfaces[0]?.manifest)).toContain(
      "Edited later",
    );
  });

  test("replays an identical retry and conflicts on a changed payload", async () => {
    const { access, harness, root } = setup();
    const base = {
      approvalId: "a1",
      approvedItemIds: ["record:Document:d1", "field:Document:d1:title"],
      liveItemIds: [],
      publishAnyway: false,
      root,
    };
    const first = await access.approve(ACCOUNT, base);
    expect(await access.approve(ACCOUNT, base)).toEqual(first);
    expect(harness.revisions).toHaveLength(1);
    await expect(
      access.approve(ACCOUNT, {
        ...base,
        approvedItemIds: [...base.approvedItemIds, "field:Document:d1:body"],
      }),
    ).rejects.toBeInstanceOf(LinkSharingConflictError);
  });

  test("shows the last scope approval time on the surface and nothing to a visitor", async () => {
    const { access, harness, root } = setup();
    await access.approve(ACCOUNT, {
      approvalId: "a1",
      approvedItemIds: ["record:Document:d1", "field:Document:d1:title"],
      liveItemIds: [],
      publishAnyway: false,
      root,
    });
    const preview = await previewOf(access, root);
    expect(preview.surface?.lastApprovedAt).toBe("2026-01-01T00:00:00.000Z");
    harness.setSource(root, documentSource({ title: "Renamed" }));
    const stored = JSON.stringify(harness.surfaces[0]?.manifest);
    for (const hint of [
      "diff",
      "candidate",
      "pending",
      "Never approved",
      "added",
    ]) {
      expect(stored).not.toContain(hint);
    }
  });
});

describe("Link Sharing placeholders", () => {
  const withBody = (body: string) =>
    documentSource({
      fields: [{ key: "body", kind: "markdown", label: "Body", value: body }],
      parts: [],
    });

  test("lists record, field and text context; code and inline code are ignored", async () => {
    const body = [
      "Dear {{musteri_adi}}, welcome.",
      "",
      "```",
      "{{in_fence}}",
      "```",
      "Use `{{inline_code}}` as is and {{Not Valid}} or {single}.",
    ].join("\n");
    const { access, root } = setup(withBody(body));
    const preview = await previewOf(access, root);
    expect(preview.placeholders).toHaveLength(1);
    expect(preview.placeholders[0]).toMatchObject({
      fieldKey: "body",
      fieldLabel: "Body",
      placeholder: "{{musteri_adi}}",
      recordId: "d1",
      recordKind: "Document",
      recordTitle: "Launch plan",
    });
    expect(preview.placeholders[0]?.context).toContain(
      "Dear {{musteri_adi}}, welcome.",
    );
  });

  test("scope approval does not consume the warning; Publish/share anyway is separate", async () => {
    const { access, harness, root } = setup(withBody("Hi {{alan_adı}}"));
    const base = {
      approvalId: "a1",
      approvedItemIds: [
        "record:Document:d1",
        "field:Document:d1:title",
        "field:Document:d1:body",
      ],
      liveItemIds: [],
      root,
    };
    await expect(
      access.approve(ACCOUNT, { ...base, publishAnyway: false }),
    ).rejects.toBeInstanceOf(LinkSharingPlaceholdersError);
    expect(harness.surfaces).toHaveLength(0);
    await access.approve(ACCOUNT, {
      ...base,
      approvalId: "a2",
      publishAnyway: true,
    });
    expect(harness.surfaces[0]?.manifest.placeholdersAcknowledged).toBe(true);
  });

  test("a placeholder in a field the founder leaves out does not warn on approval", async () => {
    const { access } = setup(withBody("Hi {{alan_adı}}"));
    const approved = await access.approve(ACCOUNT, {
      approvalId: "a1",
      approvedItemIds: ["record:Document:d1", "field:Document:d1:title"],
      liveItemIds: [],
      publishAnyway: false,
      root: DOC,
    });
    expect(approved?.revision).toBe(1);
  });
});

describe("Link Sharing live allow-list", () => {
  const workRoot: ShareRoot = { id: "w1", kind: "Work" };
  const workSource = (): ShareSource => ({
    blockers: [],
    members: [],
    projectId: PROJECT,
    record: workRecord("w1", "Ship it", "In Progress"),
  });
  const base = {
    approvalId: "a1",
    publishAnyway: false,
    root: workRoot,
  };
  const approved = [
    "record:Work:w1",
    "field:Work:w1:title",
    "field:Work:w1:description",
    "field:Work:w1:status",
  ];

  test("marks only allow-listed fields Live and labels the surface Some fields live", async () => {
    const { access } = setup(workSource(), workRoot);
    const result = await access.approve(ACCOUNT, {
      ...base,
      approvedItemIds: approved,
      liveItemIds: ["field:Work:w1:status"],
    });
    expect(result?.label).toBe("Some fields live");
  });

  test("labels a surface with nothing live Approved snapshot, never Current", async () => {
    const { access } = setup(workSource(), workRoot);
    const result = await access.approve(ACCOUNT, {
      ...base,
      approvedItemIds: approved,
      liveItemIds: [],
    });
    expect(result?.label).toBe("Approved snapshot");
    expect(JSON.stringify(result)).not.toContain("Current");
  });

  test.each(["title", "description"])(
    "refuses to mark %s Live",
    async (key) => {
      const { access } = setup(workSource(), workRoot);
      await expect(
        access.approve(ACCOUNT, {
          ...base,
          approvedItemIds: approved,
          liveItemIds: [`field:Work:w1:${key}`],
        }),
      ).rejects.toThrow("allow-list");
    },
  );

  test("refuses Live for a field that is not approved", async () => {
    const { access } = setup(workSource(), workRoot);
    await expect(
      access.approve(ACCOUNT, {
        ...base,
        approvedItemIds: approved,
        liveItemIds: ["field:Work:w1:roadmapHorizon"],
      }),
    ).rejects.toThrow("allow-list");
  });
});

describe("Link Sharing collection scope", () => {
  const roadmap: ShareRoot = { id: PROJECT, kind: "Roadmap" };
  const rootRecord: ShareSourceRecord = {
    fields: [],
    id: PROJECT,
    kind: "Roadmap",
    parts: [],
    title: "Roadmap",
  };
  const inRoadmap = (values: Record<string, string | null>) =>
    values.roadmapHorizon !== null && values.roadmapHorizon !== undefined;
  const collection = (works: ShareSourceRecord[]): ShareSource => ({
    blockers: [],
    members: works.map((record) => ({ matchesFilter: inRoadmap, record })),
    projectId: PROJECT,
    record: rootRecord,
  });
  const recordIds = (preview: ShareScopePreview) =>
    preview.items.filter((item) => item.kind === "Record");

  test("lists the first matches one by one and approves only what the founder selects", async () => {
    const source = collection([
      workRecord("w1", "One", "Not Started"),
      workRecord("w2", "Two", "Not Started"),
      workRecord("w3", "Off roadmap", "Not Started", null),
    ]);
    const { access, harness } = setup(source, roadmap);
    const preview = await previewOf(access, roadmap);
    expect(recordIds(preview).map((item) => item.itemId)).toEqual([
      `record:Roadmap:${PROJECT}`,
      "record:Work:w1",
      "record:Work:w2",
    ]);
    await access.approve(ACCOUNT, {
      approvalId: "a1",
      approvedItemIds: [
        `record:Roadmap:${PROJECT}`,
        "record:Work:w1",
        "field:Work:w1:title",
      ],
      liveItemIds: [],
      publishAnyway: false,
      root: roadmap,
    });
    expect(JSON.stringify(harness.surfaces[0]?.manifest)).not.toContain("Two");
  });

  test("a record entering the filter later is only a candidate on the owner's diff", async () => {
    const { access, harness } = setup(
      collection([workRecord("w1", "One", "Not Started")]),
      roadmap,
    );
    await access.approve(ACCOUNT, {
      approvalId: "a1",
      approvedItemIds: [
        `record:Roadmap:${PROJECT}`,
        "record:Work:w1",
        "field:Work:w1:title",
      ],
      liveItemIds: [],
      publishAnyway: false,
      root: roadmap,
    });
    harness.setSource(
      roadmap,
      collection([
        workRecord("w1", "One", "Not Started"),
        workRecord("w2", "New match", "Not Started"),
      ]),
    );
    const preview = await previewOf(access, roadmap);
    const candidate = preview.items.find(
      (item) => item.itemId === "record:Work:w2",
    );
    expect(candidate).toMatchObject({
      candidate: true,
      state: "Never approved",
    });
    expect(JSON.stringify(harness.surfaces[0]?.manifest)).not.toContain(
      "New match",
    );
  });

  test("an approved record stays through non-live edits and leaves only through live field membership loss", async () => {
    const { access, harness } = setup(
      collection([workRecord("w1", "One", "Not Started", "Now")]),
      roadmap,
    );
    await access.approve(ACCOUNT, {
      approvalId: "a1",
      approvedItemIds: [
        `record:Roadmap:${PROJECT}`,
        "record:Work:w1",
        "field:Work:w1:title",
        "field:Work:w1:roadmapHorizon",
      ],
      liveItemIds: [],
      publishAnyway: false,
      root: roadmap,
    });
    // The horizon left the filter but was approved frozen: membership holds.
    harness.setSource(
      roadmap,
      collection([workRecord("w1", "One", "Not Started", null)]),
    );
    let preview = await previewOf(access, roadmap);
    expect(
      preview.items.find((item) => item.itemId === "record:Work:w1")
        ?.leavesScope,
    ).toBe(false);

    // Same loss, but the horizon was marked Live: the record leaves the link.
    await access.approve(ACCOUNT, {
      approvalId: "a2",
      approvedItemIds: [
        `record:Roadmap:${PROJECT}`,
        "record:Work:w1",
        "field:Work:w1:title",
        "field:Work:w1:roadmapHorizon",
      ],
      liveItemIds: ["field:Work:w1:roadmapHorizon"],
      publishAnyway: false,
      root: roadmap,
    });
    preview = await previewOf(access, roadmap);
    const leaving = preview.items.find(
      (item) => item.itemId === "record:Work:w1",
    );
    expect(leaving).toMatchObject({ leavesScope: true, selectable: false });
    await expect(
      access.approve(ACCOUNT, {
        approvalId: "a3",
        approvedItemIds: [`record:Roadmap:${PROJECT}`, "record:Work:w1"],
        liveItemIds: [],
        publishAnyway: false,
        root: roadmap,
      }),
    ).rejects.toBeInstanceOf(LinkSharingScopeError);
  });

  test("a Wall card, its exact attachment version and the layout are separate items", async () => {
    const wall: ShareRoot = { id: "wall1", kind: "Project Wall" };
    const source: ShareSource = {
      blockers: [],
      members: [],
      projectId: PROJECT,
      record: {
        fields: [],
        id: "wall1",
        kind: "Project Wall",
        parts: [
          { detail: "Work", id: "card1", kind: "Card", label: "Card: Ship it" },
          { detail: "v3", id: "file1", kind: "Attachment", label: "mock.png" },
          {
            detail: "2 cards",
            id: "layout",
            kind: "Layout",
            label: "Wall layout",
          },
          {
            detail: null,
            id: "coll",
            kind: "Live collection block",
            label: "Smart Collection block",
          },
        ],
        title: "Wall",
      },
    };
    const { access } = setup(source, wall);
    const preview = await previewOf(access, wall);
    expect(
      preview.items
        .filter((item) => item.kind !== "Record" && item.kind !== "Field")
        .map((item) => item.kind),
    ).toEqual(["Card", "Attachment", "Layout", "Live collection block"]);
    const result = await access.approve(ACCOUNT, {
      approvalId: "a1",
      approvedItemIds: [
        "record:Project Wall:wall1",
        "part:Project Wall:wall1:layout",
      ],
      liveItemIds: [],
      publishAnyway: false,
      root: wall,
    });
    expect(result?.revision).toBe(1);
  });
});
