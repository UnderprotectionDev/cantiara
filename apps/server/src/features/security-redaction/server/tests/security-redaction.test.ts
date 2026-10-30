import {
  SecurityRedactionGrantRejectedError,
  type SecurityRedactionLocatorSource,
  SecurityRedactionTypedNameMismatchError,
} from "@cantiara/api/security-redaction";
import { describe, expect, test, vi } from "vitest";

import { createSecurityRedaction } from "../security-redaction";

const ACTOR = { accountId: "account-1", accountName: "Mert" };
const VALUE = "sk-live-very-secret";
const NOW = new Date("2026-03-01T10:00:00.000Z");

/** Account Access grant double: one grant, valid once, for `security-redaction` only. */
function grantDouble(options: { expired?: boolean; operation?: string } = {}) {
  const spent = new Set<string>();
  return vi.fn((grant: string) => {
    const valid =
      grant === "grant-1" &&
      !options.expired &&
      (options.operation ?? "security-redaction") === "security-redaction" &&
      !spent.has(grant);
    if (valid) {
      spent.add(grant);
    }
    return Promise.resolve(valid);
  });
}

function setup() {
  const sources: SecurityRedactionLocatorSource[] = [
    {
      kind: "current-field",
      locate: () =>
        Promise.resolve([
          {
            kind: "current-field",
            location: "description",
            recordId: "w1",
            recordKind: "Work",
          },
        ]),
    },
    {
      kind: "history-revision",
      locate: () =>
        Promise.resolve([
          {
            kind: "history-revision",
            location: "revision 2",
            recordId: "w1",
            recordKind: "Work",
          },
        ]),
    },
  ];
  return createSecurityRedaction({
    locators: sources,
    now: () => NOW,
    projectName: (accountId, projectId) =>
      Promise.resolve(
        accountId === "account-1" && projectId === "project-1" ? "Atlas" : null,
      ),
  });
}

const project = { kind: "Project", projectId: "project-1" } as const;
const apply = (overrides: Record<string, unknown> = {}) =>
  ({
    grant: "grant-1",
    scope: project,
    sensitiveValue: VALUE,
    typedName: "Atlas",
    ...overrides,
  }) as never;

describe("Security Redaction preview", () => {
  test("lists locators and states the free Markdown limit without echoing the value", async () => {
    const preview = await setup().preview(ACTOR, {
      scope: project,
      sensitiveValue: VALUE,
    });

    expect(preview?.locators.map((l) => l.kind)).toEqual([
      "current-field",
      "history-revision",
    ]);
    expect(preview?.notSearched).toEqual([
      "external-surface-snapshot",
      "search-index",
      "export-staging",
      "cache",
    ]);
    expect(preview?.detectionLimit).toContain("does not detect secrets");
    expect(preview?.typedNameTarget).toEqual({
      kind: "Project",
      name: "Atlas",
    });
    expect(JSON.stringify(preview)).not.toContain(VALUE);
  });

  test("is refused for a Project that is not the Account's", async () => {
    await expect(
      setup().preview(ACTOR, {
        scope: { kind: "Project", projectId: "other" },
        sensitiveValue: VALUE,
      }),
    ).resolves.toBeNull();
  });
});

describe("Security Redaction apply gate", () => {
  test("passes with the matching name and consumes the grant once, removing nothing", async () => {
    const consume = grantDouble();
    const result = await setup().apply(ACTOR, apply(), consume);

    expect(result).toEqual({
      passedAt: NOW.toISOString(),
      removal: "not-performed",
      scope: project,
      status: "gate-passed",
    });
    expect(consume).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain(VALUE);
  });

  test("accepts the Account name for the Account scope", async () => {
    const result = await setup().apply(
      ACTOR,
      apply({ scope: { kind: "Account" }, typedName: "Mert" }),
      grantDouble(),
    );
    expect(result?.status).toBe("gate-passed");
  });

  test("rejects a missing grant", async () => {
    await expect(
      setup().apply(ACTOR, apply({ grant: "none" }), grantDouble()),
    ).rejects.toBeInstanceOf(SecurityRedactionGrantRejectedError);
  });

  test("rejects an expired grant", async () => {
    await expect(
      setup().apply(ACTOR, apply(), grantDouble({ expired: true })),
    ).rejects.toBeInstanceOf(SecurityRedactionGrantRejectedError);
  });

  test("rejects a grant minted for another operation", async () => {
    await expect(
      setup().apply(
        ACTOR,
        apply(),
        grantDouble({ operation: "early-permanent-delete" }),
      ),
    ).rejects.toBeInstanceOf(SecurityRedactionGrantRejectedError);
  });

  test("rejects a replayed grant", async () => {
    const redaction = setup();
    const consume = grantDouble();
    await redaction.apply(ACTOR, apply(), consume);
    await expect(
      redaction.apply(ACTOR, apply(), consume),
    ).rejects.toBeInstanceOf(SecurityRedactionGrantRejectedError);
  });

  test("rejects a name mismatch before the grant is consumed, record title included", async () => {
    const consume = grantDouble();
    await expect(
      setup().apply(ACTOR, apply({ typedName: "Ship it" }), consume),
    ).rejects.toBeInstanceOf(SecurityRedactionTypedNameMismatchError);
    expect(consume).not.toHaveBeenCalled();
  });

  test("refuses a foreign Project before the name or grant is looked at", async () => {
    const consume = grantDouble();
    await expect(
      setup().apply(
        ACTOR,
        apply({ scope: { kind: "Project", projectId: "other" } }),
        consume,
      ),
    ).resolves.toBeNull();
    expect(consume).not.toHaveBeenCalled();
  });
});
