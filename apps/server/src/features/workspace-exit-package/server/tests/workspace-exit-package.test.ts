import {
  ExitPackageError,
  type ExitSourceFile,
} from "@cantiara/api/workspace-exit-package";
import { describe, expect, test } from "vitest";

import { unpackExitPackage } from "../exit-package-archive";
import { openExitPackage } from "../exit-package-envelope";
import { createWorkspaceExitPackage } from "../workspace-exit-package";
import { createMemoryExitPackageStore } from "./workspace-exit-package-memory";

const password = "unique-pass-phrase-7731";
const files: ExitSourceFile[] = [
  {
    content: "# Note",
    family: "content",
    kind: "markdown",
    path: "content/note.md",
  },
  {
    content: "{}",
    family: "history",
    kind: "json",
    path: "history/events.json",
  },
];

function setup(start = new Date("2026-10-31T10:00:00Z")) {
  const clock = { now: start };
  const memory = createMemoryExitPackageStore();
  const exit = createWorkspaceExitPackage({
    now: () => clock.now,
    source: {
      read: ({ accountId }) =>
        Promise.resolve(accountId === "a1" ? files : null),
    },
    store: memory.store,
  });
  return { clock, exit, memory };
}

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => "none",
    (error: unknown) =>
      error instanceof ExitPackageError ? error.code : "other",
  );

describe("Workspace Exit Package production", () => {
  test("preview returns the manifest and stores nothing downloadable", async () => {
    const { exit, memory } = setup();
    const manifest = await exit.preview({ accountId: "a1" });
    expect(manifest.files).toHaveLength(2);
    expect(memory.activeCount()).toBe(0);
    expect(await exit.successfulProduction({ accountId: "a1" })).toBeNull();
  });

  test("produces an encrypted download that only the password opens, and never stores the password", async () => {
    const { exit, memory } = setup();
    const produced = await exit.produce({ accountId: "a1", password });
    const bytes = await exit.download(produced.download.token);
    expect(Buffer.from(bytes).includes(Buffer.from("# Note"))).toBe(false);
    const opened = unpackExitPackage(openExitPackage(bytes, password));
    expect(opened.manifest.files.map((file) => file.path)).toEqual([
      "content/note.md",
      "history/events.json",
    ]);
    const stored = JSON.stringify(memory.snapshot(), (_key, value: unknown) =>
      value instanceof Uint8Array
        ? Buffer.from(value).toString("latin1")
        : value,
    );
    expect(stored).not.toContain(password);
    expect(stored).not.toContain(produced.download.token);
  });

  test("a weak or empty password and an unreadable Workspace are refused", async () => {
    const { exit } = setup();
    expect(await code(exit.produce({ accountId: "a1", password: "" }))).toBe(
      "invalid_password",
    );
    expect(
      await code(exit.produce({ accountId: "a1", password: "short" })),
    ).toBe("invalid_password");
    expect(await code(exit.produce({ accountId: "other", password }))).toBe(
      "source_unavailable",
    );
    expect(
      await code(
        exit.produce({ accountId: "a1", downloadWindowMs: 0, password }),
      ),
    ).toBe("invalid_download_window");
  });

  test("download closes at expiry and on revoke", async () => {
    const { clock, exit } = setup();
    const first = await exit.produce({ accountId: "a1", password });
    clock.now = new Date(clock.now.getTime() + 24 * 3_600_000 + 1);
    expect(await code(exit.download(first.download.token))).toBe(
      "download_expired",
    );
    const second = await exit.produce({ accountId: "a1", password });
    await exit.download(second.download.token);
    await exit.revoke({ accountId: "a1", packageId: second.packageId });
    expect(await code(exit.download(second.download.token))).toBe(
      "download_revoked",
    );
    expect(await code(exit.download("not-a-token"))).toBe("download_not_found");
  });

  test("closure can ask for 30 days but no more", async () => {
    const { clock, exit } = setup();
    const thirtyDays = 30 * 24 * 3_600_000;
    const produced = await exit.produce({
      accountId: "a1",
      downloadWindowMs: thirtyDays,
      password,
    });
    clock.now = new Date(clock.now.getTime() + thirtyDays - 1000);
    await exit.download(produced.download.token);
    expect(
      await code(
        exit.produce({
          accountId: "a1",
          downloadWindowMs: thirtyDays + 1,
          password,
        }),
      ),
    ).toBe("invalid_download_window");
  });

  test("a new package replaces the old one: no restore-point library", async () => {
    const { exit, memory } = setup();
    const first = await exit.produce({ accountId: "a1", password });
    const second = await exit.produce({ accountId: "a1", password });
    expect(memory.activeCount()).toBe(1);
    expect(await code(exit.download(first.download.token))).toBe(
      "download_not_found",
    );
    await exit.download(second.download.token);
  });

  test("successful production stays queryable after the download window closes", async () => {
    const { clock, exit } = setup();
    const produced = await exit.produce({ accountId: "a1", password });
    clock.now = new Date(clock.now.getTime() + 40 * 24 * 3_600_000);
    expect(
      (await exit.successfulProduction({ accountId: "a1" }))?.packageId,
    ).toBe(produced.packageId);
    expect(await exit.successfulProduction({ accountId: "other" })).toBeNull();
  });

  test("exposes no restore, import, recovery or scheduling operation", () => {
    const names = Object.keys(setup().exit).join(" ").toLowerCase();
    for (const forbidden of [
      "restore",
      "import",
      "recover",
      "schedule",
      "email",
    ]) {
      expect(names).not.toContain(forbidden);
    }
  });
});
