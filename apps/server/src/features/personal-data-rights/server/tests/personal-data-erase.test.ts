import {
  ERASE_PERSONAL_DATA_LABEL,
  PERSONAL_DATA_SPECIAL_CATEGORY_WARNING,
  type PersonalDataAuditEntry,
  type PersonalDataRedaction,
  type PersonalDataSnapshot,
} from "@cantiara/api/personal-data-rights";
import {
  SecurityRedactionGrantRejectedError,
  type SecurityRedactionLocator,
  type SecurityRedactionRequest,
  SecurityRedactionTypedNameMismatchError,
} from "@cantiara/api/security-redaction";
import { describe, expect, test } from "vitest";
import { createPersonalDataRights } from "../personal-data-package";

const ACCOUNT = { accountId: "account-1", accountName: "Mert Demirkaya" };
const MESSAGE = "Please let me export my data.";

function snapshot(): PersonalDataSnapshot {
  return {
    contact: {
      archivedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      displayName: "Ada Lovelace",
      emails: ["ada@example.com"],
      id: "contact-ada",
      updatedAt: "2026-02-01T00:00:00.000Z",
    },
    evidence: [],
    feedback: [
      {
        channel: "Email",
        id: "feedback-1",
        occurredAt: "2026-01-05T00:00:00.000Z",
        originalMessage: MESSAGE,
        status: "New",
        title: "Export request",
        url: null,
      },
    ],
    research: [],
  };
}

const PUBLISHED_COPY: SecurityRedactionLocator = {
  kind: "external-surface-snapshot",
  location: "snapshot",
  recordId: "surface-1",
  recordKind: "External Surface",
};

function setup({ grants = ["grant-1"] }: { grants?: string[] } = {}) {
  const writes: string[] = [];
  const spreadRequests: SecurityRedactionRequest[] = [];
  const events: { reason: string; scope: string }[] = [];
  const audit: PersonalDataAuditEntry[] = [];
  const tombstones: { contactId: string; values: readonly string[] }[] = [];
  const unused = new Set(grants);
  let consumeCalls = 0;
  const consume = (grant: string) => {
    consumeCalls += 1;
    return Promise.resolve(unused.delete(grant));
  };
  // The Security Redaction (78) double: same gate order as the real apply
  // (typed name, then the grant consumed once, then the spread), recording the
  // calls it receives. The real engine is tested on 78's own seam.
  const redaction: PersonalDataRedaction = {
    apply: async (actor, input, consumeGrant) => {
      if (input.typedName !== actor.accountName) {
        throw new SecurityRedactionTypedNameMismatchError();
      }
      if (!(await consumeGrant(input.grant))) {
        throw new SecurityRedactionGrantRejectedError();
      }
      writes.push("event");
      events.push({ reason: input.reason, scope: input.scope.kind });
      writes.push("spread");
      spreadRequests.push({
        accountId: actor.accountId,
        scope: input.scope,
        sensitiveValue: input.sensitiveValue,
      });
      return {
        actorAlias: "actor-alias",
        passedAt: "2026-03-01T00:00:00.000Z",
        reason: input.reason,
        removal: {
          targets: [
            { copies: 1, kind: "external-surface-snapshot", status: "removed" },
            { copies: 1, kind: "cache", status: "removed" },
          ],
        },
        scope: input.scope,
        status: "redacted",
      };
    },
    preview: (_actor, input) =>
      Promise.resolve({
        detectionLimit: "limit",
        locators:
          input.sensitiveValue === "Ada Lovelace" ? [PUBLISHED_COPY] : [],
        notSearched: ["export-staging"],
        typedNameTarget: { kind: "Account", name: ACCOUNT.accountName },
      }),
  };
  const access = createPersonalDataRights(
    {
      read: (_accountId, contactId) =>
        Promise.resolve(contactId === "contact-ada" ? snapshot() : null),
    },
    {
      audit: {
        record: (entry) => {
          audit.push(entry);
          return Promise.resolve();
        },
      },
      eraser: {
        tombstone: (_accountId, contactId, values) => {
          writes.push("tombstone");
          tombstones.push({ contactId, values });
          return Promise.resolve({
            contacts: 1,
            emailAliases: 1,
            evidence: 0,
            feedback: 1,
            research: 0,
          });
        },
      },
      redaction,
    },
  );
  return {
    access,
    audit,
    consume,
    consumeCalls: () => consumeCalls,
    events,
    spreadRequests,
    tombstones,
    writes,
  };
}

async function erase(
  harness: ReturnType<typeof setup>,
  overrides: { grant?: string; typedName?: string } = {},
) {
  const preview = await harness.access.previewErase(ACCOUNT, {
    contactId: "contact-ada",
  });
  return harness.access.erase(
    ACCOUNT,
    {
      contactId: "contact-ada",
      grant: overrides.grant ?? "grant-1",
      previewFingerprint: preview.fingerprint,
      typedName: overrides.typedName ?? ACCOUNT.accountName,
    },
    harness.consume,
  );
}

describe("Personal Data Rights: Erase Personal Data", () => {
  test("preview lists the Contact, Feedback and the published copy and writes nothing", async () => {
    const harness = setup();
    const preview = await harness.access.previewErase(ACCOUNT, {
      contactId: "contact-ada",
    });
    expect(preview.sources.map((source) => source.kind)).toContain("Feedback");
    expect(preview.copies).toEqual([PUBLISHED_COPY]);
    expect(preview.typedNameTarget).toEqual({
      kind: "Account",
      name: ACCOUNT.accountName,
    });
    const notices = preview.notices.join(" ");
    expect(notices).toContain("irreversible");
    expect(notices).toContain("not Trash");
    expect(notices).toContain("not Account closure");
    expect(preview.notices).toContain(PERSONAL_DATA_SPECIAL_CATEGORY_WARNING);
    expect(harness.writes).toEqual([]);
    expect(harness.consumeCalls()).toBe(0);
    expect(ERASE_PERSONAL_DATA_LABEL).toBe("Erase Personal Data");
  });

  test("calls Security Redaction for every personal value, published copies included", async () => {
    const harness = setup();
    const result = await erase(harness);
    // Longest first, so a message holding a name goes before the name.
    expect(
      harness.spreadRequests.map((request) => request.sensitiveValue),
    ).toEqual([MESSAGE, "ada@example.com", "Ada Lovelace"]);
    expect(
      harness.spreadRequests.every(
        (request) =>
          request.accountId === ACCOUNT.accountId &&
          request.scope.kind === "Account",
      ),
    ).toBe(true);
    expect(harness.events).toHaveLength(3);
    expect(result.status).toBe("erased");
    const removal = Object.fromEntries(
      result.removal.map((target) => [target.kind, target]),
    );
    expect(removal["external-surface-snapshot"]).toMatchObject({
      copies: 3,
      status: "removed",
    });
    expect(removal.cache).toMatchObject({ copies: 3, status: "removed" });
    expect(harness.consumeCalls()).toBe(1);
  });

  test("the tombstone is content-free and runs after redaction", async () => {
    const harness = setup();
    const result = await erase(harness);
    expect(harness.writes.at(-1)).toBe("tombstone");
    expect(harness.writes.indexOf("spread")).toBeLessThan(
      harness.writes.indexOf("tombstone"),
    );
    expect(result.tombstone).toEqual({
      contacts: 1,
      emailAliases: 1,
      evidence: 0,
      feedback: 1,
      research: 0,
    });
    // Counts only: neither the result nor the audit entry carries a value.
    const visible = JSON.stringify([result, harness.audit, harness.events]);
    for (const value of ["Ada Lovelace", "ada@example.com", MESSAGE]) {
      expect(visible).not.toContain(value);
    }
  });

  test("does not touch Trash or close the Account", async () => {
    const harness = setup();
    await erase(harness);
    expect(harness.writes.filter((write) => write !== "event")).toEqual([
      "spread",
      "spread",
      "spread",
      "tombstone",
    ]);
  });

  test("a missing grant is rejected with no write", async () => {
    const harness = setup({ grants: [] });
    await expect(erase(harness)).rejects.toMatchObject({
      code: "grant_rejected",
    });
    expect(harness.writes).toEqual([]);
    expect(harness.audit).toEqual([]);
  });

  test("a replayed grant is rejected with no write", async () => {
    const harness = setup();
    await erase(harness);
    const writesAfterFirst = harness.writes.length;
    await expect(erase(harness)).rejects.toMatchObject({
      code: "grant_rejected",
    });
    expect(harness.writes).toHaveLength(writesAfterFirst);
  });

  test("a typed name mismatch is rejected before the grant is consumed", async () => {
    const harness = setup();
    await expect(
      erase(harness, { typedName: "Someone Else" }),
    ).rejects.toMatchObject({ code: "name_mismatch" });
    expect(harness.consumeCalls()).toBe(0);
    expect(harness.writes).toEqual([]);
    // The one-time proof was not burnt by the typo.
    await expect(erase(harness)).resolves.toMatchObject({ status: "erased" });
  });

  test("a stale preview is refused with no write", async () => {
    const harness = setup();
    await expect(
      harness.access.erase(
        ACCOUNT,
        {
          contactId: "contact-ada",
          grant: "grant-1",
          previewFingerprint: "stale",
          typedName: ACCOUNT.accountName,
        },
        harness.consume,
      ),
    ).rejects.toMatchObject({ code: "preview_required" });
    expect(harness.writes).toEqual([]);
    expect(harness.consumeCalls()).toBe(0);
  });

  test("an unknown Contact is not found and writes nothing", async () => {
    const harness = setup();
    await expect(
      harness.access.previewErase(ACCOUNT, { contactId: "missing" }),
    ).rejects.toMatchObject({ code: "contact_not_found" });
    expect(harness.writes).toEqual([]);
  });

  test("records the erase in the audit without personal values", async () => {
    const harness = setup();
    await erase(harness);
    expect(harness.audit).toEqual([
      expect.objectContaining({
        accountId: ACCOUNT.accountId,
        contactId: "contact-ada",
        type: "personal-data.erased",
      }),
    ]);
  });

  test("records an export in the audit without personal values", async () => {
    const harness = setup();
    const preview = await harness.access.preview(ACCOUNT.accountId, {
      contactId: "contact-ada",
    });
    await harness.access.produce(ACCOUNT.accountId, {
      contactId: "contact-ada",
      format: "JSON",
      previewFingerprint: preview.fingerprint,
    });
    expect(harness.audit).toEqual([
      expect.objectContaining({
        contactId: "contact-ada",
        type: "personal-data.exported",
      }),
    ]);
    expect(JSON.stringify(harness.audit)).not.toContain("Ada Lovelace");
  });

  test("a Contact with no personal value still needs the grant and the name", async () => {
    const harness = setup();
    const empty = createPersonalDataRights(
      {
        read: () =>
          Promise.resolve({
            ...snapshot(),
            contact: { ...snapshot().contact, displayName: null, emails: [] },
            feedback: [],
          }),
      },
      {
        eraser: {
          tombstone: () => {
            harness.writes.push("tombstone");
            return Promise.resolve({
              contacts: 1,
              emailAliases: 0,
              evidence: 0,
              feedback: 0,
              research: 0,
            });
          },
        },
        redaction: {
          apply: () => Promise.reject(new Error("unused")),
          preview: () => Promise.resolve(null),
        },
      },
    );
    const preview = await empty.previewErase(ACCOUNT, {
      contactId: "contact-ada",
    });
    const input = {
      contactId: "contact-ada",
      grant: "grant-1",
      previewFingerprint: preview.fingerprint,
      typedName: ACCOUNT.accountName,
    };
    await expect(
      empty.erase(ACCOUNT, input, () => Promise.resolve(false)),
    ).rejects.toMatchObject({ code: "grant_rejected" });
    expect(harness.writes).toEqual([]);
    await expect(
      empty.erase(ACCOUNT, input, harness.consume),
    ).resolves.toMatchObject({ status: "erased" });
    expect(harness.writes).toEqual(["tombstone"]);
  });
});
