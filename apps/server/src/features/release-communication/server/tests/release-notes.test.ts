import { ReleaseCommunicationError } from "@cantiara/api/release-communication";
import { describe, expect, test } from "vitest";

import {
  ACCOUNT_ID,
  createFixtures,
  createScopeWork,
  RELEASE_ID,
} from "./release-communication-fixtures";

const draft = {
  body: "The editor now starts in one click.",
  releaseId: RELEASE_ID,
  scopeWorkIds: ["work-1"],
};

async function saved(fixtures = createFixtures(), extra: object = {}) {
  const note = await fixtures.access.saveDraft(ACCOUNT_ID, {
    ...draft,
    ...extra,
    baseRevision: 0,
  });
  if (!note) {
    throw new Error("draft not saved");
  }
  return { fixtures, note };
}

async function approvalFor(
  fixtures: ReturnType<typeof createFixtures>,
  noteId: string,
) {
  const preview = await fixtures.access.previewPublish(ACCOUNT_ID, noteId);
  if (!preview) {
    throw new Error("no preview");
  }
  return {
    approval: {
      buildInPublicEventIds: preview.buildInPublicEvents.map((e) => e.id),
      changelogLinkHrefs: preview.changelogLinks.map((l) => l.href),
      fingerprint: preview.fingerprint,
      publicLabels: preview.scope.flatMap((item) =>
        item.proposedPublicLabel
          ? [{ label: item.proposedPublicLabel, workId: item.workId }]
          : [],
      ),
      whyTrail: preview.whyTrail.map((item) => ({
        approvedFields: item.proposedFields.map((f) => f.name),
        sourceId: item.sourceId,
        sourceType: item.sourceType,
      })),
    },
    noteId,
  };
}

describe("Release notes bound to scope", () => {
  test("a draft needs scope binds and every bind lives in the Release scope", async () => {
    const fixtures = createFixtures();
    await expect(
      fixtures.access.saveDraft(ACCOUNT_ID, {
        ...draft,
        baseRevision: 0,
        scopeWorkIds: [],
      }),
    ).rejects.toThrow();
    await expect(
      fixtures.access.saveDraft(ACCOUNT_ID, {
        ...draft,
        baseRevision: 0,
        scopeWorkIds: ["work-elsewhere"],
      }),
    ).rejects.toMatchObject({ code: "RELEASE_COMMUNICATION_SCOPE_INVALID" });
    expect(await fixtures.access.listNotes(ACCOUNT_ID, RELEASE_ID)).toEqual([]);
  });

  test("a draft stays private: the changelog lists only published snapshots", async () => {
    const { fixtures } = await saved();
    expect(
      await fixtures.access.changelog(ACCOUNT_ID, {
        projectId: "project-1",
        tagIds: [],
      }),
    ).toEqual([]);
  });

  test("GitHub Release text has no input: it is not accepted as the note", async () => {
    const fixtures = createFixtures();
    await expect(
      fixtures.access.saveDraft(ACCOUNT_ID, {
        ...draft,
        baseRevision: 0,
        githubReleaseBody: "copied from GitHub",
      } as never),
    ).rejects.toThrow();
  });

  test("stale drafts conflict and another account sees nothing", async () => {
    const { fixtures, note } = await saved();
    await expect(
      fixtures.access.saveDraft(ACCOUNT_ID, {
        ...draft,
        baseRevision: 0,
        noteId: note.id,
      }),
    ).rejects.toMatchObject({ code: "RELEASE_COMMUNICATION_STALE_REVISION" });
    expect(
      await fixtures.access.listNotes("someone-else", RELEASE_ID),
    ).toBeNull();
    expect(
      await fixtures.access.previewPublish("someone-else", note.id),
    ).toBeNull();
  });

  test("tags must already exist in the Project", async () => {
    const fixtures = createFixtures();
    await expect(
      fixtures.access.saveDraft(ACCOUNT_ID, {
        ...draft,
        baseRevision: 0,
        tagIds: ["invented-changelog-tag"],
      }),
    ).rejects.toBeInstanceOf(ReleaseCommunicationError);
  });
});

describe("Publish-close preview", () => {
  test("shows statuses, labels, links, trail snapshots and events together and writes nothing", async () => {
    const { fixtures, note } = await saved(createFixtures(), {
      whyTrail: [
        {
          approvedFields: ["Summary"],
          sourceId: "decision-1",
          sourceType: "Decision",
        },
      ],
    });

    const preview = await fixtures.access.previewPublish(ACCOUNT_ID, note.id);

    expect(preview).toMatchObject({
      buildInPublicEvents: [{ id: "event-1" }],
      changelogLinks: [{ label: "Changelog" }],
      findings: [],
      scope: [
        {
          currentPublicLabel: null,
          internalStatus: "Closed",
          proposedPublicLabel: "Released",
          workId: "work-1",
        },
      ],
      whyTrail: [
        {
          proposedFields: [
            { name: "Summary", value: "Starting in one click matters most." },
          ],
        },
      ],
      written: false,
    });
    // Cancelling is leaving: the draft is untouched and nothing is public.
    const [still] =
      (await fixtures.access.listNotes(ACCOUNT_ID, RELEASE_ID)) ?? [];
    expect(still?.status).toBe("Draft");
    expect(
      await fixtures.access.changelog(ACCOUNT_ID, {
        projectId: "project-1",
        tagIds: [],
      }),
    ).toEqual([]);
  });

  test("selecting a record publishes none of its fields", async () => {
    const { fixtures, note } = await saved(createFixtures(), {
      whyTrail: [{ sourceId: "decision-1", sourceType: "Decision" }],
    });
    const preview = await fixtures.access.previewPublish(ACCOUNT_ID, note.id);
    expect(preview?.whyTrail).toEqual([]);

    const entry = await fixtures.access.publish(
      ACCOUNT_ID,
      await approvalFor(fixtures, note.id),
    );
    expect(entry?.whyTrail).toEqual([]);
  });

  test("text-only notes publish without a Why was this done? trail", async () => {
    const { fixtures, note } = await saved();
    const entry = await fixtures.access.publish(
      ACCOUNT_ID,
      await approvalFor(fixtures, note.id),
    );
    expect(entry).toMatchObject({ body: draft.body, whyTrail: [] });
  });

  test("blocks placeholders, secrets, out-of-scope Work keys and echoed private records", async () => {
    const fixtures = createFixtures();
    const cases = [
      ["TODO write the real note", "placeholder"],
      ["Mail founder@example.com for access", "sensitive-data"],
      ["This also fixes CNT-9", "closed-world"],
      ["Because of the Start-up decision", "indirect-leak"],
    ] as const;
    for (const [body, check] of cases) {
      // biome-ignore lint/performance/noAwaitInLoops: each case is its own draft.
      const note = await fixtures.access.saveDraft(ACCOUNT_ID, {
        ...draft,
        baseRevision: 0,
        body,
        whyTrail: [{ sourceId: "decision-1", sourceType: "Decision" }],
      });
      const preview = await fixtures.access.previewPublish(
        ACCOUNT_ID,
        note?.id ?? "",
      );
      expect(preview?.findings.map((f) => f.check)).toContain(check);
      await expect(
        fixtures.access.publish(ACCOUNT_ID, {
          approval: {
            buildInPublicEventIds: [],
            changelogLinkHrefs: [],
            fingerprint: preview?.fingerprint ?? "",
            publicLabels: [],
            whyTrail: [],
          },
          noteId: note?.id ?? "",
        }),
      ).rejects.toMatchObject({
        code: "RELEASE_COMMUNICATION_PREVIEW_BLOCKED",
      });
    }
  });

  test("a changed draft makes the earlier approval stale", async () => {
    const { fixtures, note } = await saved();
    const approval = await approvalFor(fixtures, note.id);
    await fixtures.access.saveDraft(ACCOUNT_ID, {
      ...draft,
      baseRevision: note.revision,
      body: "A different note.",
      noteId: note.id,
    });
    await expect(
      fixtures.access.publish(ACCOUNT_ID, approval),
    ).rejects.toMatchObject({
      code: "RELEASE_COMMUNICATION_PREVIEW_STALE",
    });
  });
});

describe("Publish", () => {
  test("applies only the approved items; the rest stays private and unchanged", async () => {
    const fixtures = createFixtures({
      scope: [
        createScopeWork(),
        createScopeWork({
          id: "work-2",
          internalStatus: "Blocked",
          key: "CNT-2",
          proposedPublicLabel: "Released",
          title: "Editor shortcuts",
        }),
      ],
    });
    const { note } = await saved(fixtures, {
      scopeWorkIds: ["work-1", "work-2"],
      whyTrail: [
        {
          approvedFields: ["Summary", "Context"],
          sourceId: "decision-1",
          sourceType: "Decision",
        },
      ],
    });
    const full = await approvalFor(fixtures, note.id);

    const entry = await fixtures.access.publish(ACCOUNT_ID, {
      ...full,
      approval: {
        ...full.approval,
        publicLabels: [{ label: "Released", workId: "work-1" }],
        whyTrail: [
          {
            approvedFields: ["Summary"],
            sourceId: "decision-1",
            sourceType: "Decision",
          },
        ],
      },
    });

    expect(entry?.publicLabels).toEqual([
      { label: "Released", workId: "work-1" },
    ]);
    expect(entry?.whyTrail[0]?.proposedFields).toEqual([
      { name: "Summary", value: "Starting in one click matters most." },
    ]);
  });

  test("an unproposed label cannot be smuggled in by approval", async () => {
    const { fixtures, note } = await saved();
    const full = await approvalFor(fixtures, note.id);
    const entry = await fixtures.access.publish(ACCOUNT_ID, {
      ...full,
      approval: {
        ...full.approval,
        publicLabels: [{ label: "Completed", workId: "work-1" }],
      },
    });
    expect(entry?.publicLabels).toEqual([]);
    expect(entry?.buildInPublicEventIds).toEqual(["event-1"]);
  });

  test("never completes Work or writes a Release status, and the note is frozen", async () => {
    const { fixtures, note } = await saved();
    const before = JSON.stringify({
      release: fixtures.release,
      scope: fixtures.scope,
    });

    await fixtures.access.publish(
      ACCOUNT_ID,
      await approvalFor(fixtures, note.id),
    );

    expect(
      JSON.stringify({ release: fixtures.release, scope: fixtures.scope }),
    ).toBe(before);
    expect(fixtures.release.status).toBe("Preparing");
    await expect(
      fixtures.access.saveDraft(ACCOUNT_ID, {
        ...draft,
        baseRevision: note.revision,
        noteId: note.id,
      }),
    ).rejects.toMatchObject({
      code: "RELEASE_COMMUNICATION_ALREADY_PUBLISHED",
    });
  });

  test("the changelog assembles published notes across Releases and filters by existing tags", async () => {
    const fixtures = createFixtures();
    const first = await saved(fixtures, { tagIds: ["tag-editor"] });
    await fixtures.access.publish(
      ACCOUNT_ID,
      await approvalFor(fixtures, first.note.id),
    );
    const second = await fixtures.access.saveDraft(ACCOUNT_ID, {
      ...draft,
      baseRevision: 0,
      body: "Shortcuts landed.",
      tagIds: ["tag-shortcuts"],
    });
    await fixtures.access.publish(
      ACCOUNT_ID,
      await approvalFor(fixtures, second?.id ?? ""),
    );

    const all = await fixtures.access.changelog(ACCOUNT_ID, {
      projectId: "project-1",
      tagIds: [],
    });
    const editor = await fixtures.access.changelog(ACCOUNT_ID, {
      projectId: "project-1",
      tagIds: ["tag-editor"],
    });
    expect(all).toHaveLength(2);
    expect(editor?.map((entry) => entry.body)).toEqual([draft.body]);
  });
});
