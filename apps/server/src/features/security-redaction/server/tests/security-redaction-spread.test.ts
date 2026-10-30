import {
  REDACTED_VALUE_MARK,
  redactJson,
  redactText,
  SECURITY_REDACTION_LOCATOR_KINDS,
  SecurityRedactionGrantRejectedError,
  type SecurityRedactionLocatorKind,
  SecurityRedactionSpreadIncompleteError,
  type SecurityRedactionTargetAdapter,
  SecurityRedactionTypedNameMismatchError,
} from "@cantiara/api/security-redaction";
import { describe, expect, test, vi } from "vitest";

import { createSecurityRedaction } from "../security-redaction";
import { createSurfaceCacheRedactionTarget } from "../security-redaction-database";
import { createSecurityRedactionSpread } from "../security-redaction-spread";

const ACTOR = { accountId: "account-1", accountName: "Mert" };
const SECRET = "sk-live-very-secret";
const NOW = new Date("2026-03-01T10:00:00.000Z");

/** A world with one copy of the value in every closed spread target. */
function world() {
  return {
    // The History event keeps its type, time and actor; only the value is replaced.
    history: [
      {
        actor: "founder",
        eventType: "field-changed",
        occurredAt: "2026-01-02T00:00:00.000Z",
        previous: `token ${SECRET}`,
      },
      {
        actor: "founder",
        eventType: "field-changed",
        occurredAt: "2026-01-03T00:00:00.000Z",
        previous: "untouched",
      },
    ],
    cache: new Map([["surface-1:page", `<p>${SECRET}</p>`]]),
    current: { description: `use ${SECRET} to deploy`, title: "Deploy" },
    exportStaging: [`export of ${SECRET}`],
    searchIndex: new Map([["w1", `deploy ${SECRET}`]]),
    surface: {
      state: "Revoked" as "Revoked" | "Aktif",
      snapshot: { body: `see ${SECRET}` },
      token: "token-hash",
    },
  };
}

type World = ReturnType<typeof world>;

/** Test doubles per target: each removes through the same pure helpers. */
function adapters(w: World): Record<string, SecurityRedactionTargetAdapter> {
  const count = (before: string, after: string) => (before === after ? 0 : 1);
  return {
    cache: {
      kind: "cache",
      remove: ({ sensitiveValue }) => {
        let removed = 0;
        for (const [key, body] of w.cache) {
          removed += count(body, redactText(body, sensitiveValue));
          w.cache.delete(key);
        }
        return Promise.resolve(removed);
      },
    },
    "current-field": {
      kind: "current-field",
      remove: ({ sensitiveValue }) => {
        const next = redactJson(w.current, sensitiveValue);
        w.current = next.value as World["current"];
        return Promise.resolve(next.changed ? 1 : 0);
      },
    },
    "export-staging": {
      kind: "export-staging",
      remove: ({ sensitiveValue }) => {
        const before = w.exportStaging.join();
        w.exportStaging = w.exportStaging.map((entry) =>
          redactText(entry, sensitiveValue),
        );
        return Promise.resolve(count(before, w.exportStaging.join()));
      },
    },
    "external-surface-snapshot": {
      kind: "external-surface-snapshot",
      remove: ({ sensitiveValue }) => {
        const next = redactJson(w.surface.snapshot, sensitiveValue);
        w.surface.snapshot = next.value as World["surface"]["snapshot"];
        return Promise.resolve(next.changed ? 1 : 0);
      },
    },
    "history-revision": {
      kind: "history-revision",
      remove: ({ sensitiveValue }) => {
        const next = redactJson(w.history, sensitiveValue);
        w.history = next.value as World["history"];
        return Promise.resolve(next.changed ? 1 : 0);
      },
    },
    "search-index": {
      kind: "search-index",
      remove: ({ sensitiveValue }) => {
        for (const [key, text] of w.searchIndex) {
          w.searchIndex.set(key, redactText(text, sensitiveValue));
        }
        return Promise.resolve(1);
      },
    },
  };
}

const project = { kind: "Project", projectId: "project-1" } as const;
const input = (overrides: Record<string, unknown> = {}) =>
  ({
    grant: "grant-1",
    reason: "Leaked key",
    scope: project,
    sensitiveValue: SECRET,
    typedName: "Atlas",
    ...overrides,
  }) as never;

function setup(targets: SecurityRedactionTargetAdapter[]) {
  return createSecurityRedaction({
    now: () => NOW,
    projectName: (accountId, projectId) =>
      Promise.resolve(
        accountId === "account-1" && projectId === "project-1" ? "Atlas" : null,
      ),
    recording: {
      actorAlias: () => Promise.resolve("alias"),
      log: {
        append: () => Promise.resolve(),
        list: () => Promise.resolve({ events: [], unreadable: 0 }),
      },
      replayKey: "test-key",
    },
    spread: createSecurityRedactionSpread(targets),
  });
}

const grant = () => vi.fn(() => Promise.resolve(true));

describe("Security Redaction spread", () => {
  test.each(SECURITY_REDACTION_LOCATOR_KINDS.map((kind) => [kind]))(
    "removes the value from %s and reports it removed",
    async (kind) => {
      const w = world();
      const all = adapters(w);
      const result = await setup(Object.values(all)).apply(
        ACTOR,
        input(),
        grant(),
      );

      const outcome = result?.removal.targets.find(
        (target) => target.kind === kind,
      );
      expect(outcome).toMatchObject({ kind, status: "removed" });
      expect(
        JSON.stringify(w, (_key, value) =>
          value instanceof Map ? [...value] : value,
        ),
      ).not.toContain(SECRET);
    },
  );

  test("current, history, snapshot, search, export and cache stop yielding the value", async () => {
    const w = world();
    await setup(Object.values(adapters(w))).apply(ACTOR, input(), grant());

    expect(w.current.description).toBe(`use ${REDACTED_VALUE_MARK} to deploy`);
    expect(w.history.at(0)?.previous).toBe(`token ${REDACTED_VALUE_MARK}`);
    expect(w.surface.snapshot.body).toBe(`see ${REDACTED_VALUE_MARK}`);
    expect(w.searchIndex.get("w1")).not.toContain(SECRET);
    expect(w.exportStaging.join()).not.toContain(SECRET);
    expect(w.cache.size).toBe(0);
  });

  test("the history mark keeps event type, time and actor and holds no value", async () => {
    const w = world();
    const before = structuredClone(w.history);
    await setup(Object.values(adapters(w))).apply(ACTOR, input(), grant());

    expect(w.history[0]).toMatchObject({
      actor: before[0]?.actor,
      eventType: before[0]?.eventType,
      occurredAt: before[0]?.occurredAt,
    });
    expect(JSON.stringify(w.history)).not.toContain(SECRET);
    // A row without the value is not touched at all.
    expect(w.history[1]).toEqual(before[1]);
  });

  test("a Secret that leaked into copies is spread like any other value", async () => {
    const w = world();
    w.history.push({
      actor: "founder",
      eventType: "share-password-set",
      occurredAt: "2026-01-04T00:00:00.000Z",
      previous: "hunter2-share-password",
    });
    w.surface.snapshot = { body: "password hunter2-share-password" };
    await setup(Object.values(adapters(w))).apply(
      ACTOR,
      input({ sensitiveValue: "hunter2-share-password" }),
      grant(),
    );

    expect(JSON.stringify(w.history)).not.toContain("hunter2-share-password");
    expect(JSON.stringify(w.surface.snapshot)).not.toContain(
      "hunter2-share-password",
    );
  });

  test("snapshot redaction leaves the External Surface revoked and mints nothing", async () => {
    const w = world();
    const before = { state: w.surface.state, token: w.surface.token };
    await setup(Object.values(adapters(w))).apply(ACTOR, input(), grant());

    expect({ state: w.surface.state, token: w.surface.token }).toEqual(before);
    expect(w.surface.state).not.toBe("Aktif");
  });

  test("an ordinary edit is not redaction: history keeps the value until apply", () => {
    const w = world();
    w.current = { ...w.current, description: "rewritten" };

    expect(JSON.stringify(w.history)).toContain(SECRET);
    expect(JSON.stringify(w.surface.snapshot)).toContain(SECRET);
  });

  test("a target without a store is reported not-wired and never as clean", async () => {
    const w = world();
    const { "export-staging": _unused, ...wired } = adapters(w);
    const result = await setup(Object.values(wired)).apply(
      ACTOR,
      input(),
      grant(),
    );

    expect(
      result?.removal.targets.find(
        (target) => target.kind === "export-staging",
      ),
    ).toEqual({ copies: 0, kind: "export-staging", status: "not-wired" });
  });

  test("a store that keeps no copy of its own is reported as such", async () => {
    const result = await setup([
      { kind: "search-index", remove: () => Promise.resolve(null) },
    ]).apply(ACTOR, input(), grant());

    expect(
      result?.removal.targets.find((target) => target.kind === "search-index"),
    ).toMatchObject({ status: "no-stored-copy" });
  });

  test("a failing target does not stop the others and its error names kinds only", async () => {
    const w = world();
    const all = adapters(w);
    const failing: SecurityRedactionTargetAdapter = {
      kind: "cache",
      remove: () => Promise.reject(new Error(`driver echoed ${SECRET}`)),
    };
    const targets = Object.values({ ...all, cache: failing });

    const error = await setup(targets)
      .apply(ACTOR, input(), grant())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SecurityRedactionSpreadIncompleteError);
    expect((error as SecurityRedactionSpreadIncompleteError).failed).toEqual([
      "cache" satisfies SecurityRedactionLocatorKind,
    ]);
    expect(String((error as Error).message)).not.toContain(SECRET);
    expect(w.current.description).not.toContain(SECRET);
  });

  test("a refused gate removes nothing", async () => {
    const w = world();
    const targets = Object.values(adapters(w));
    const spy = vi.spyOn(
      targets[0] as SecurityRedactionTargetAdapter,
      "remove",
    );

    await expect(
      setup(targets).apply(ACTOR, input({ typedName: "Deploy" }), grant()),
    ).rejects.toBeInstanceOf(SecurityRedactionTypedNameMismatchError);
    await expect(
      setup(targets).apply(
        ACTOR,
        input(),
        vi.fn(() => Promise.resolve(false)),
      ),
    ).rejects.toBeInstanceOf(SecurityRedactionGrantRejectedError);

    expect(spy).not.toHaveBeenCalled();
    expect(w.current.description).toContain(SECRET);
  });

  test("runs only after the grant is consumed and never logs the value", async () => {
    const order: string[] = [];
    const log = vi.spyOn(console, "log");
    const error = vi.spyOn(console, "error");
    const result = await setup([
      {
        kind: "current-field",
        remove: () => {
          order.push("spread");
          return Promise.resolve(1);
        },
      },
    ]).apply(ACTOR, input(), () => {
      order.push("grant");
      return Promise.resolve(true);
    });

    expect(order).toEqual(["grant", "spread"]);
    expect(result?.status).toBe("redacted");
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(
      JSON.stringify([...log.mock.calls, ...error.mock.calls]),
    ).not.toContain(SECRET);
  });
});

describe("redaction helpers", () => {
  test("redactJson keeps the shape and reports whether a copy was found", () => {
    expect(
      redactJson({ a: ["x s y", 1, null], b: { s: "keep" } }, "s"),
    ).toEqual({
      changed: true,
      value: {
        a: [`x ${REDACTED_VALUE_MARK} y`, 1, null],
        b: { [REDACTED_VALUE_MARK]: "keep" },
      },
    });
    expect(redactJson({ a: "clean" }, "zzz").changed).toBe(false);
  });
});

describe("Security Redaction surface cache target", () => {
  test("a cache without purge is reported not-wired, never a clean zero", async () => {
    const target = createSurfaceCacheRedactionTarget(
      {} as never,
      {
        get: () => Promise.resolve(null),
        set: () => Promise.resolve(),
      } as never,
    );
    expect(
      await target.remove({
        accountId: "account-1",
        scope: { kind: "Account" },
        sensitiveValue: SECRET,
      }),
    ).toBeNull();
  });
});
