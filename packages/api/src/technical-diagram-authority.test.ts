import { describe, expect, test } from "vitest";

import {
  assertAuthorityUnchanged,
  assertPreviewedConversion,
  CREATABLE_AUTHORITY_MODES,
  createTechnicalDiagramInputSchema,
  DIAGRAM_AUTHORITY_MODES,
  DiagramAuthorityError,
  previewAuthorityConversion,
} from "./technical-diagram-authority";

const key = "11111111-1111-4111-8111-111111111111";
const externalSource = {
  lastCheckedAt: "2026-10-20T09:00:00.000Z",
  revision: "rev-7",
  tool: "Excalidraw",
  url: "https://excalidraw.com/#room=abc",
};
const source = {
  authorityMode: "Product-authored Model" as const,
  id: "diagram-1",
  model: {
    links: [{ from: "a", kind: "Calls" as const, label: null, to: "b" }],
    nodes: [
      { id: "a", kind: "Service" as const, label: "API" },
      { id: "b", kind: "Datastore" as const, label: "DB" },
    ],
  },
  type: "Technical Architecture" as const,
};

describe("Diagram Authority Mode matrix", () => {
  test("keeps a closed catalog of four modes and mints only three", () => {
    expect(DIAGRAM_AUTHORITY_MODES).toEqual([
      "Product-authored Model",
      "Repository-derived View",
      "Imported Independent Copy",
      "External Source Link",
    ]);
    expect(CREATABLE_AUTHORITY_MODES).not.toContain("Repository-derived View");
  });

  test("creates Product-authored Model and External Source Link directly", () => {
    expect(
      createTechnicalDiagramInputSchema.safeParse({
        authorityMode: "Product-authored Model",
        clientIdempotencyKey: key,
        projectId: "p",
        title: "Platform",
        type: "Data Model",
      }).success,
    ).toBe(true);
    expect(
      createTechnicalDiagramInputSchema.safeParse({
        authorityMode: "External Source Link",
        clientIdempotencyKey: key,
        externalSource,
        projectId: "p",
        title: "Board",
        type: "Technical Architecture",
      }).success,
    ).toBe(true);
  });

  test("refuses Repository-derived View, direct imports and unknown modes", () => {
    for (const authorityMode of [
      "Repository-derived View",
      "Imported Independent Copy",
      "Anything else",
    ]) {
      expect(
        createTechnicalDiagramInputSchema.safeParse({
          authorityMode,
          clientIdempotencyKey: key,
          projectId: "p",
          title: "Platform",
          type: "Data Model",
        }).success,
      ).toBe(false);
    }
  });

  test("refuses in-place reclassification but accepts the same mode", () => {
    expect(() =>
      assertAuthorityUnchanged(
        "Product-authored Model",
        "External Source Link",
      ),
    ).toThrow(DiagramAuthorityError);
    expect(() =>
      assertAuthorityUnchanged(
        "Product-authored Model",
        "Product-authored Model",
      ),
    ).not.toThrow();
  });
});

describe("External Source Link", () => {
  const create = (patch: Record<string, unknown>) =>
    createTechnicalDiagramInputSchema.safeParse({
      authorityMode: "External Source Link",
      clientIdempotencyKey: key,
      externalSource: { ...externalSource, ...patch },
      projectId: "p",
      title: "Board",
      type: "Technical Architecture",
    }).success;

  test("requires an exact HTTPS URL, tool and last check", () => {
    expect(create({})).toBe(true);
    expect(create({ revision: null })).toBe(true);
    expect(create({ url: "http://example.com/a" })).toBe(false);
    expect(create({ url: "javascript:alert(1)" })).toBe(false);
    expect(create({ url: "https://user:pw@example.com/a" })).toBe(false);
    expect(create({ url: "example.com" })).toBe(false);
    expect(create({ tool: " " })).toBe(false);
    expect(create({ lastCheckedAt: "yesterday" })).toBe(false);
  });

  test("carries no content, embed or edit field", () => {
    expect(
      createTechnicalDiagramInputSchema.safeParse({
        authorityMode: "External Source Link",
        clientIdempotencyKey: key,
        externalSource: { ...externalSource, iframe: true },
        projectId: "p",
        title: "Board",
        type: "Technical Architecture",
      }).success,
    ).toBe(false);
    expect(
      createTechnicalDiagramInputSchema.safeParse({
        authorityMode: "External Source Link",
        clientIdempotencyKey: key,
        externalSource,
        model: { links: [], nodes: [] },
        projectId: "p",
        title: "Board",
        type: "Technical Architecture",
      }).success,
    ).toBe(false);
  });
});

describe("authority conversion", () => {
  const input = {
    sourceDiagramId: "diagram-1",
    targetMode: "Imported Independent Copy" as const,
    title: "Imported platform",
  };

  test("previews source mode, target mode, loss, history and a new identity", async () => {
    const preview = await previewAuthorityConversion(source, input);
    expect(preview).toMatchObject({
      canConvert: true,
      newIdentity: true,
      origin: { source: "Originates from" },
      sourceMode: "Product-authored Model",
      targetMode: "Imported Independent Copy",
    });
    expect(preview.loss.length).toBeGreaterThan(0);
    expect(preview.history).toContain("Originates from");
  });

  test("cannot convert to the same mode or to Repository-derived View", async () => {
    expect(
      (
        await previewAuthorityConversion(source, {
          ...input,
          targetMode: "Product-authored Model",
        })
      ).canConvert,
    ).toBe(false);
    expect(
      (
        await previewAuthorityConversion(source, {
          ...input,
          targetMode: "External Source Link",
        })
      ).canConvert,
    ).toBe(false);
  });

  test("writes only with the token of the current preview", async () => {
    const { previewToken } = await previewAuthorityConversion(source, input);
    const confirm = { ...input, clientIdempotencyKey: key, previewToken };
    await expect(
      assertPreviewedConversion(source, confirm),
    ).resolves.toMatchObject({ canConvert: true });
    await expect(
      assertPreviewedConversion(source, {
        ...confirm,
        previewToken: "0".repeat(64),
      }),
    ).rejects.toThrow(DiagramAuthorityError);
    await expect(
      assertPreviewedConversion(source, { ...confirm, title: "Other title" }),
    ).rejects.toThrow(DiagramAuthorityError);
    await expect(
      assertPreviewedConversion(
        { ...source, model: { links: [], nodes: [] } },
        confirm,
      ),
    ).rejects.toThrow(DiagramAuthorityError);
  });

  test("converting to External Source Link needs the exact link", async () => {
    const link = {
      ...input,
      targetMode: "External Source Link" as const,
    };
    expect((await previewAuthorityConversion(source, link)).canConvert).toBe(
      false,
    );
    expect(
      (await previewAuthorityConversion(source, { ...link, externalSource }))
        .canConvert,
    ).toBe(true);
  });
});
