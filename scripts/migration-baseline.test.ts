import { expect, it } from "vitest";
import { migrationBaseline } from "./migration-baseline";
import { workspaceRoot } from "./workspace-database";

it("matches the checked-in migration baseline without mixing the two databases", () => {
  const primary = migrationBaseline(workspaceRoot, "HEAD", false);
  const security = migrationBaseline(workspaceRoot, "HEAD", true);
  const journal = JSON.parse(
    primary.files.get("meta/_journal.json")?.toString() ?? "{}",
  ) as { entries: { tag: string }[] };
  for (const entry of journal.entries) {
    expect(primary.files.has(`${entry.tag}.sql`)).toBe(true);
  }
  expect(primary.files.has("0000_big_shadowcat.sql")).toBe(true);
  expect(
    [...primary.files.keys()].some((name) => name.includes("security-events")),
  ).toBe(false);
  expect(security.files.size).toBeLessThan(primary.files.size);
  expect(primary.fingerprint).toBe(
    migrationBaseline(workspaceRoot, undefined, false).fingerprint,
  );
  expect(primary.fingerprint).not.toBe(security.fingerprint);
});
