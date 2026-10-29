import { WikiPublishingError } from "@cantiara/api/wiki-publishing";
import { describe, expect, test } from "vitest";

import {
  ACCOUNT_ID,
  createFixtures,
  ROOT_ID,
} from "./wiki-publishing-fixtures";

async function previewOf(fixtures = createFixtures()) {
  const preview = await fixtures.access.preview(ACCOUNT_ID, ROOT_ID);
  if (!preview) {
    throw new Error("preview expected");
  }
  return { fixtures, preview };
}

function approval(
  preview: { fingerprint: string },
  ids: string[],
  publishAnyway = false,
) {
  return {
    approval: {
      approvedEmbedIds: ids,
      fingerprint: preview.fingerprint,
      publishAnyway,
    },
    documentId: ROOT_ID,
  };
}

describe("Wiki Publishing preview", () => {
  test("lists the exact record, version and fields, then every embed as its own approval item", async () => {
    const { preview } = await previewOf();

    expect(preview.root).toMatchObject({
      recordId: ROOT_ID,
      recordType: "Document",
      version: 4,
    });
    expect(preview.root.fields.map((field) => field.name)).toEqual([
      "Title",
      "Body",
    ]);
    expect(
      preview.embeds.map((embed) => [embed.kind, embed.member.title]),
    ).toEqual([
      ["Inline reference", "Ship weekly"],
      ["Inline reference", "Vendor lock-in"],
      ["Live Smart Collection", "Open bugs"],
      ["Live content section", "Intro"],
      ["Child document", "Child notes"],
      ["Backlink", "Private journal"],
      ["Attachment", "diagram.png"],
    ]);
    expect(new Set(preview.embeds.map((embed) => embed.id)).size).toBe(7);
    const attachment = preview.embeds.find(
      (embed) => embed.kind === "Attachment",
    );
    expect(attachment?.member.files).toEqual([
      { attachmentId: "file-1", name: "diagram.png", version: 3 },
    ]);
    expect(preview.written).toBe(false);
  });

  test("writes nothing and creates no surface", async () => {
    const { fixtures } = await previewOf();

    expect(fixtures.surfaces.size).toBe(0);
  });

  test("never offers Secret fields and says free text is not scanned", async () => {
    const { preview } = await previewOf();

    const child = preview.embeds.find(
      (embed) => embed.kind === "Child document",
    );
    expect(child?.member.fields.map((field) => field.name)).toEqual([
      "Title",
      "Body",
    ]);
    expect(JSON.stringify(preview)).not.toContain("CODE-123");
    expect(preview.notice).toContain("not scanned for secrets");
  });

  test("returns null for a Document that is not an owned Wiki Document", async () => {
    const { access } = createFixtures();

    expect(await access.preview(ACCOUNT_ID, "project-doc")).toBeNull();
    expect(await access.preview("account-2", ROOT_ID)).toBeNull();
  });
});

describe("Wiki Publishing approval", () => {
  test("publishes an independent public surface with only the approved embeds", async () => {
    const { fixtures, preview } = await previewOf();
    const ship = preview.embeds[0]?.id ?? "";

    const published = await fixtures.access.publish(
      ACCOUNT_ID,
      approval(preview, [ship]),
    );

    expect(published).toMatchObject({
      documentId: ROOT_ID,
      projectId: null,
      revision: 1,
    });
    const [snapshot] = [...fixtures.surfaces.values()][0]?.snapshots ?? [];
    expect(snapshot?.members.map((member) => member.title)).toEqual([
      "Ship weekly",
    ]);
    const serialized = JSON.stringify(snapshot);
    for (const leaked of [
      "Vendor lock-in",
      "Open bugs",
      "Intro text",
      "Child notes",
      "Private journal",
      "diagram.png",
      "risk-1",
      "view-1",
      "wiki-2",
      "wiki-9",
      "CODE-123",
    ]) {
      expect(serialized).not.toContain(leaked);
    }
    expect(snapshot?.body).toContain("Ship weekly");
    expect(snapshot?.body).not.toContain(":::live");
  });

  test("freezes approved live blocks with source and date label and no source link", async () => {
    const { fixtures, preview } = await previewOf();
    const live = preview.embeds.find(
      (embed) => embed.kind === "Live Smart Collection",
    );

    await fixtures.access.publish(
      ACCOUNT_ID,
      approval(preview, [live?.id ?? ""]),
    );

    const [snapshot] = [...fixtures.surfaces.values()][0]?.snapshots ?? [];
    expect(snapshot?.members[0]?.liveLabel).toBe(
      "Snapshot of Open bugs view on 2026-10-29",
    );
    expect(snapshot?.body).toContain(':::snapshot-block{memberId="member-1"}');
    expect(snapshot?.body).not.toContain("view-1");
  });

  test("keeps the approved revision when the live Wiki changes afterwards", async () => {
    const { fixtures, preview } = await previewOf();
    await fixtures.access.publish(ACCOUNT_ID, approval(preview, []));

    fixtures.state.root.body = "Rewritten";
    fixtures.state.root.title = "Rewritten";

    const [surface] = [...fixtures.surfaces.values()];
    expect(surface?.snapshots).toHaveLength(1);
    expect(surface?.snapshots[0]?.title).toBe("Release habits");
  });

  test("rejects a preview that changed before approval", async () => {
    const { fixtures, preview } = await previewOf();
    fixtures.state.root.version = 5;

    await expect(
      fixtures.access.publish(ACCOUNT_ID, approval(preview, [])),
    ).rejects.toMatchObject({ code: "WIKI_PUBLISHING_PREVIEW_STALE" });
    expect(fixtures.surfaces.size).toBe(0);
  });

  test("a second approval adds a revision to the same surface", async () => {
    const { fixtures, preview } = await previewOf();
    await fixtures.access.publish(ACCOUNT_ID, approval(preview, []));
    const again = await fixtures.access.publish(
      ACCOUNT_ID,
      approval(preview, []),
    );

    expect(again?.revision).toBe(2);
    expect(fixtures.surfaces.size).toBe(1);
  });
});

describe("Wiki Publishing unresolved placeholders", () => {
  const body = [
    "Hello {{customer_name}}.",
    "",
    "Use `{{ignored_inline}}` here.",
    "",
    "```",
    "{{ignored_fence}}",
    "```",
    "",
    "[[record:Decision:decision-1|Ship weekly]]",
  ].join("\n");

  test("lists the source record, field and text context and ignores code", async () => {
    const { preview } = await previewOf(createFixtures({ rootBody: body }));

    expect(preview.placeholders).toEqual([
      {
        context: expect.stringContaining("Hello {{customer_name}}."),
        embedId: null,
        field: "Body",
        name: "customer_name",
        sourceRecord: {
          id: ROOT_ID,
          title: "Release habits",
          type: "Document",
        },
      },
    ]);
  });

  test("blocks until resolved or separately confirmed with Publish/share anyway", async () => {
    const { fixtures, preview } = await previewOf(
      createFixtures({ rootBody: body }),
    );

    await expect(
      fixtures.access.publish(ACCOUNT_ID, approval(preview, [])),
    ).rejects.toBeInstanceOf(WikiPublishingError);
    expect(fixtures.surfaces.size).toBe(0);

    const published = await fixtures.access.publish(
      ACCOUNT_ID,
      approval(preview, [], true),
    );
    expect(published?.revision).toBe(1);
  });

  test("a placeholder inside an unapproved embed is listed but does not block", async () => {
    const fixtures = createFixtures();
    fixtures.state.child.fields[1] = {
      name: "Body",
      value: "Dear {{secret_name}}",
    };
    const { preview } = await previewOf(fixtures);

    expect(preview.placeholders).toEqual([
      expect.objectContaining({ embedId: "child:wiki-2", name: "secret_name" }),
    ]);
    const published = await fixtures.access.publish(
      ACCOUNT_ID,
      approval(preview, []),
    );
    expect(published?.revision).toBe(1);
  });
});
