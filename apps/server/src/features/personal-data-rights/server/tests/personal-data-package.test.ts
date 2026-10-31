import {
  PERSONAL_DATA_SOURCES,
  type PersonalDataReader,
  type PersonalDataSnapshot,
} from "@cantiara/api/personal-data-rights";
import { describe, expect, test } from "vitest";
import { createPersonalDataRights } from "../personal-data-package";

const NAMES_OTHER_PACKAGES = /exit package|account closure|backup/i;
const MARKDOWN_FILE_NAME = /^personal-data-.*\.md$/;

/** `Kişisel veri` fixture: aliases, Feedback, Research consent, evidence. */
function snapshot(
  overrides: Partial<PersonalDataSnapshot> = {},
): PersonalDataSnapshot {
  return {
    contact: {
      archivedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      displayName: "Ada Lovelace",
      emails: ["ada@example.com", "ada.l@example.org"],
      id: "contact-ada",
      updatedAt: "2026-02-01T00:00:00.000Z",
    },
    evidence: [
      {
        createdAt: "2026-03-01T00:00:00.000Z",
        id: "evidence-1",
        interpretation: "Shows the export need",
        role: "Supporting",
        sourceRecordId: "feedback-1",
        targetRecordId: "decision-1",
        targetRecordType: "Decision",
      },
    ],
    feedback: [
      {
        channel: "Email",
        id: "feedback-1",
        occurredAt: "2026-01-05T00:00:00.000Z",
        originalMessage: "Please let me export my data.",
        status: "New",
        title: "Export request",
        url: null,
      },
    ],
    research: [
      {
        data: { consent: "Allowed", title: "Interview", sessionToken: "abc" },
        id: "research-1",
        title: "Interview",
      },
    ],
    ...overrides,
  };
}

function rights(data: PersonalDataSnapshot | null = snapshot()) {
  const reads: [string, string][] = [];
  const reader: PersonalDataReader = {
    read(accountId, contactId) {
      reads.push([accountId, contactId]);
      return Promise.resolve(data);
    },
  };
  return { access: createPersonalDataRights(reader), reads };
}

describe("Personal Data Rights: Export Personal Data", () => {
  test("preview lists every source before anything is produced", async () => {
    const { access } = rights();
    const preview = await access.preview("account-1", {
      contactId: "contact-ada",
    });
    expect(preview.sources.map((source) => source.kind)).toEqual([
      ...PERSONAL_DATA_SOURCES,
    ]);
    const byKind = Object.fromEntries(
      preview.sources.map((source) => [source.kind, source.items]),
    );
    expect(byKind["Email aliases"]).toHaveLength(2);
    expect(byKind.Feedback?.[0]?.label).toBe("Export request");
    expect(byKind["Related evidence"]).toHaveLength(1);
    expect(preview.excluded.join(" ")).toContain("Other Contacts");
    expect(preview.fingerprint).not.toBe("");
  });

  test("produces no package without the fingerprint of a reviewed preview", async () => {
    const { access } = rights();
    await expect(
      access.produce("account-1", {
        contactId: "contact-ada",
        format: "JSON",
        previewFingerprint: "stale",
      }),
    ).rejects.toMatchObject({ code: "preview_required" });
  });

  test("a changed source invalidates the reviewed preview", async () => {
    const first = await rights().access.preview("account-1", {
      contactId: "contact-ada",
    });
    const changed = rights(snapshot({ feedback: [] })).access;
    await expect(
      changed.produce("account-1", {
        contactId: "contact-ada",
        format: "JSON",
        previewFingerprint: first.fingerprint,
      }),
    ).rejects.toMatchObject({ code: "preview_required" });
  });

  test("JSON package holds the listed sources and no secrets", async () => {
    const { access } = rights();
    const preview = await access.preview("account-1", {
      contactId: "contact-ada",
    });
    const artifact = await access.produce("account-1", {
      contactId: "contact-ada",
      format: "JSON",
      previewFingerprint: preview.fingerprint,
    });
    const body = JSON.parse(artifact.bytes);
    expect(Object.keys(body).sort()).toEqual([
      "contact",
      "emailAliases",
      "feedback",
      "notice",
      "relatedEvidence",
      "research",
    ]);
    expect(body.emailAliases).toEqual(["ada@example.com", "ada.l@example.org"]);
    expect(body.feedback[0].originalMessage).toBe(
      "Please let me export my data.",
    );
    expect(artifact.bytes).not.toContain("sessionToken");
    expect(artifact.secretsExcluded).toContain("sessionToken");
    expect(artifact.mediaType).toBe("application/json");
  });

  test("a credential inside a Feedback message is removed", async () => {
    const base = snapshot();
    const { access } = rights({
      ...base,
      feedback: base.feedback.map((item) => ({
        ...item,
        originalMessage: "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
      })),
    });
    const preview = await access.preview("account-1", {
      contactId: "contact-ada",
    });
    const artifact = await access.produce("account-1", {
      contactId: "contact-ada",
      format: "Markdown",
      previewFingerprint: preview.fingerprint,
    });
    expect(artifact.bytes).not.toContain("ghp_");
  });

  test("Markdown package is readable and names no Exit Package or restore", async () => {
    const { access } = rights();
    const preview = await access.preview("account-1", {
      contactId: "contact-ada",
    });
    const artifact = await access.produce("account-1", {
      contactId: "contact-ada",
      format: "Markdown",
      previewFingerprint: preview.fingerprint,
    });
    expect(artifact.bytes).toContain("# Personal data: Ada Lovelace");
    expect(artifact.bytes).toContain("ada@example.com");
    expect(artifact.bytes).toContain("Please let me export my data.");
    expect(artifact.mediaType).toBe("text/markdown");
    expect(artifact.fileName).toMatch(MARKDOWN_FILE_NAME);
    for (const text of [artifact.bytes, artifact.fileName, preview.notice]) {
      expect(text).not.toMatch(NAMES_OTHER_PACKAGES);
    }
    expect(preview.notice).toContain("cannot be used to restore");
  });

  test("another Contact's data never enters the package", async () => {
    const { access, reads } = rights();
    const preview = await access.preview("account-1", {
      contactId: "contact-ada",
    });
    const artifact = await access.produce("account-1", {
      contactId: "contact-ada",
      format: "JSON",
      previewFingerprint: preview.fingerprint,
    });
    // The reader is asked for exactly one Contact of the signed-in account.
    expect(
      reads.every(
        ([account, contact]) =>
          account === "account-1" && contact === "contact-ada",
      ),
    ).toBe(true);
    expect(artifact.bytes).not.toContain("contact-grace");
  });

  test("a Contact outside the account's Workspace is not found", async () => {
    const { access } = rights(null);
    await expect(
      access.preview("account-1", { contactId: "contact-other" }),
    ).rejects.toMatchObject({ code: "contact_not_found" });
  });

  test("rejects unknown input fields", async () => {
    const { access } = rights();
    await expect(
      access.preview("account-1", {
        contactId: "contact-ada",
        workspaceId: "w-other",
      } as never),
    ).rejects.toThrow();
  });
});
