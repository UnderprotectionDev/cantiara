import { describe, expect, test } from "vitest";

import {
  BROKEN_REFERENCE_REASON_OPTIONS,
  isAllowedRelationEndpoints,
  RELATION_KIND_OPTIONS,
  RELATION_RECORD_TYPE_OPTIONS,
  RELATION_USAGE_KIND_OPTIONS,
  relationDefinition,
  relationEndpointSchema,
  relationKindSchema,
  relationRecordTypeSchema,
  relationUniqueness,
  relationUsageKindSchema,
} from "./relations";

describe("Relations seam", () => {
  test("keeps relation kinds and record types closed", () => {
    expect(RELATION_KIND_OPTIONS).toEqual([
      "Related",
      "Origin",
      "Evidence",
      "Contributes to Goal",
      "Blocks",
      "Includes",
      "Contributes to Milestone",
      "Primary spec",
      "Supersedes",
      "Implements",
      "Belongs to Company",
      "Participant",
      "Required for completion",
    ]);
    expect(RELATION_RECORD_TYPE_OPTIONS).toContain("Work");
    expect(RELATION_RECORD_TYPE_OPTIONS).toContain("Document");
    expect(RELATION_RECORD_TYPE_OPTIONS).toContain("GitHub PR");
    expect(RELATION_RECORD_TYPE_OPTIONS).not.toContain("Checklist Item");
    expect(RELATION_RECORD_TYPE_OPTIONS).not.toContain("Wireframe node");
    expect(relationKindSchema.safeParse("Custom relation").success).toBe(false);
    expect(relationRecordTypeSchema.safeParse("Custom record").success).toBe(
      false,
    );
  });

  test("keeps Related distinct from provenance and evidence", () => {
    expect(relationDefinition("Related")).toMatchObject({
      inverseLabel: "Related",
      sourceTypes: "any-main-record",
      targetTypes: "any-main-record",
    });
    expect(relationDefinition("Origin")).toMatchObject({
      inverseLabel: "Derived",
      sourceTypes: "origin-source",
      targetTypes: "produced-main-record",
    });
    expect(relationDefinition("Evidence")).toMatchObject({
      inverseLabel: "Provides evidence",
    });
    expect(
      relationEndpointSchema.parse({
        recordId: "work-1",
        recordType: "Work",
      }),
    ).toEqual({
      recordId: "work-1",
      recordType: "Work",
    });
    expect(
      isAllowedRelationEndpoints("Primary spec", "Feature", "Document version"),
    ).toBe(true);
    expect(isAllowedRelationEndpoints("Primary spec", "Work", "Document")).toBe(
      false,
    );
    expect(
      isAllowedRelationEndpoints(
        "Required for completion",
        "Work",
        "GitHub PR",
      ),
    ).toBe(true);
    expect(
      isAllowedRelationEndpoints(
        "Required for completion",
        "GitHub PR",
        "Work",
      ),
    ).toBe(true);
    expect(
      isAllowedRelationEndpoints("Origin", "Checklist Item" as never, "Work"),
    ).toBe(false);
  });

  test("uses only the closed broken-reference reasons", () => {
    expect(BROKEN_REFERENCE_REASON_OPTIONS).toEqual([
      "Archived",
      "In Trash",
      "Permanently deleted",
      "Redacted for security",
      "No access",
    ]);
    expect(() =>
      relationEndpointSchema.parse({
        brokenReason: "Secret reason",
        recordId: "work-1",
        recordType: "Work",
      }),
    ).toThrow();
  });

  test("keeps usage kinds and catalog uniqueness closed", () => {
    expect(RELATION_USAGE_KIND_OPTIONS).toEqual([
      "Inline reference",
      "Section reference",
      "Live block",
      "Pinned bind",
      "Screen reference",
    ]);
    expect(relationUsageKindSchema.safeParse("Evidence").success).toBe(false);
    expect(relationUniqueness("Primary spec")).toBe("unique-per-source");
    expect(relationUniqueness("Belongs to Company")).toBe("unique-per-source");
    expect(relationUniqueness("Participant")).toBe("unique-per-source");
    expect(relationUniqueness("Includes")).toBe("unique-per-target");
    expect(relationUniqueness("Related")).toBe("many");
    expect(relationUniqueness("Origin")).toBe("many");
  });
});
