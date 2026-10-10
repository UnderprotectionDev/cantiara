import { describe, expect, test } from "vitest";
import {
  createSourceInputSchema,
  saveSourceVersionInputSchema,
} from "./sources-and-freshness";

const capture = {
  url: "https://example.org/research",
  title: "Founder research",
  accessedAt: "2026-10-10T09:00:00.000Z",
  capturedContent: "  An exact excerpt.\n",
};
const command = {
  ...capture,
  id: "source-1",
  projectId: "project-1",
  baseRevision: 0,
  clientIdempotencyKey: "create-source",
};

describe("Sources and Freshness", () => {
  test("canonicalizes HTTP schemes without changing the captured address path or query", () => {
    expect(
      createSourceInputSchema.parse({
        ...command,
        url: "HTTPS://example.org/CaseSensitive?Token=A%2FB#Section",
      }).url,
    ).toBe("https://example.org/CaseSensitive?Token=A%2FB#Section");
    expect(
      saveSourceVersionInputSchema.parse({
        ...capture,
        url: "HtTp://example.org/CaseSensitive",
        sourceId: "source-1",
        projectId: "project-1",
        baseRevision: 1,
        clientIdempotencyKey: "new-version",
      }).url,
    ).toBe("http://example.org/CaseSensitive");
  });
  test("preserves captured text exactly and leaves unknown external provenance empty", () => {
    expect(createSourceInputSchema.parse(command)).toMatchObject({
      capturedContent: "  An exact excerpt.\n",
      provider: null,
      externalRecordType: null,
      externalId: null,
    });
  });
  test("rejects credentials, unsupported protocols and unrelated evidence or sync writes", () => {
    for (const url of [
      "https://founder:secret@example.org",
      "javascript:alert(1)",
      "file:///research",
    ]) {
      expect(
        createSourceInputSchema.safeParse({ ...command, url }).success,
      ).toBe(false);
    }
    for (const extra of [
      { credentials: "secret" },
      { evidence: { targetId: "work-1" } },
      { sync: true },
      { sourceType: "Work" },
    ]) {
      expect(
        createSourceInputSchema.safeParse({ ...command, ...extra }).success,
      ).toBe(false);
    }
    expect(
      saveSourceVersionInputSchema.parse({
        ...capture,
        sourceId: "source-1",
        projectId: "project-1",
        baseRevision: 1,
        clientIdempotencyKey: "new-version",
        provider: "Research portal",
        externalRecordType: "Article",
        externalId: "article-42",
      }),
    ).toMatchObject({
      provider: "Research portal",
      externalRecordType: "Article",
      externalId: "article-42",
    });
  });
});
