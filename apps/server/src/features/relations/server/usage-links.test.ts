import {
  USAGE_LINK_KIND_OPTIONS,
  usageLinkPayloadSchema,
} from "@cantiara/api/relations";
import { describe, expect, test } from "vitest";
import { createInMemoryUsageLinks } from "./usage-links";

const source = {
  recordId: "work-1",
  recordType: "Work",
};

const surface = {
  recordId: "document-1",
  recordType: "Document",
};

describe("Relations usage links", () => {
  test("keeps the closed usage catalog separate from Related", async () => {
    const usageLinks = createInMemoryUsageLinks();

    expect(USAGE_LINK_KIND_OPTIONS).toEqual([
      "Inline reference",
      "Section reference",
      "Live block",
      "Pinned bind",
      "Screen reference",
    ]);

    const link = await usageLinks.create("account-1", {
      kind: "Live block",
      source,
      surface,
      location: { blockId: "block-1" },
    });

    await expect(usageLinks.listBySource("account-1", source)).resolves.toEqual(
      [link],
    );
    expect(link.kind).not.toBe("Related");
    expect(link).not.toHaveProperty("evidenceRole");
    expect(link).not.toHaveProperty("cardinality");
  });

  test("rejects a usage kind that is not in the closed catalog", () => {
    expect(() =>
      usageLinkPayloadSchema.parse({
        kind: "Related",
        source,
        surface,
      }),
    ).toThrow();

    expect(() =>
      usageLinkPayloadSchema.parse({
        kind: "Custom embed",
        source,
        surface,
      }),
    ).toThrow();
  });

  test("unlinks the embed while keeping the source record and its status", async () => {
    const usageLinks = createInMemoryUsageLinks();
    const sourceRecord = { id: source.recordId, status: "In Progress" };
    const link = await usageLinks.create("account-1", {
      kind: "Inline reference",
      source,
      surface,
      location: { blockId: "paragraph-1", offset: 4 },
    });

    await expect(usageLinks.unlink("account-1", link.id)).resolves.toBe(true);
    await expect(usageLinks.listBySource("account-1", source)).resolves.toEqual(
      [],
    );
    expect(sourceRecord).toEqual({ id: "work-1", status: "In Progress" });
  });
});
