import { createHash } from "node:crypto";

import { DEFAULT_VISUAL_VIEW } from "@cantiara/api/moodboard-view";
import type { Moodboard } from "@cantiara/api/moodboards";
import sharp from "sharp";
import { describe, expect, test } from "vitest";

import {
  playwrightSnapshotRenderer,
  presentVisualBytes,
  snapshotDocumentHtml,
} from "../moodboard-snapshot-render";
import { buildMoodboardSnapshotOutput } from "../moodboard-snapshots-database";

const LIVE_LINK_MARKUP = /<a[\s>]|href=|https?:\/\/|<script/i;
const timestamp = "2026-10-19T09:00:00.000Z";

async function sampleImage() {
  // 40x20: left half red, right half blue.
  const left = await sharp({
    create: { background: "#ff0000", channels: 3, height: 20, width: 20 },
  })
    .png()
    .toBuffer();
  const base = sharp({
    create: { background: "#0000ff", channels: 3, height: 20, width: 40 },
  });
  return new Uint8Array(
    await base
      .composite([{ input: left, left: 0, top: 0 }])
      .png()
      .toBuffer(),
  );
}

function digest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("presenting a visual with its view-local Crop and rotation", () => {
  test("crops then rotates, and leaves the original bytes unchanged", async () => {
    const original = await sampleImage();
    const before = digest(original);

    const cropped = await presentVisualBytes(original, {
      crop: { height: 10_000, left: 5000, top: 0, width: 5000 },
      rotation: 90,
    });
    const meta = await sharp(cropped).metadata();
    const { data } = await sharp(cropped)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Right half (20x20) is entirely blue; rotation keeps it square.
    expect([meta.width, meta.height]).toEqual([20, 20]);
    expect([data[0], data[1], data[2]]).toEqual([0, 0, 255]);
    expect(digest(original)).toBe(before);
  });

  test("a quarter turn swaps the presented size and the default view keeps it", async () => {
    const original = await sampleImage();

    const turned = await sharp(
      await presentVisualBytes(original, { crop: null, rotation: 90 }),
    ).metadata();
    const same = await sharp(
      await presentVisualBytes(original, DEFAULT_VISUAL_VIEW),
    ).metadata();

    expect([turned.width, turned.height]).toEqual([20, 40]);
    expect([same.width, same.height]).toEqual([40, 20]);
  });
});

describe("snapshot page HTML", () => {
  test("carries no live source link, anchor, URL, or script", () => {
    const html = snapshotDocumentHtml([
      {
        generatedOn: "2026-10-19",
        moment: "Direction as of 2026-10-19, revision 1",
        pageNumber: 1,
        sectionTitle: "Visuals",
        tiles: [
          {
            caption: "<script>alert(1)</script>",
            kind: "placeholder",
            label: "External link visual (not embedded)",
          },
          { color: "#AA0000", kind: "swatch", note: "Accent" },
        ],
        totalPages: 1,
      },
    ]);

    expect(html).not.toMatch(LIVE_LINK_MARKUP);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("no live source links");
  });
});

describe("snapshot against its source visuals", () => {
  test("renders the edited presentation while sources and original bytes stay identical", async () => {
    const original = await sampleImage();
    const originalBefore = digest(original);
    const board: Moodboard = {
      createdAt: timestamp,
      focusOrder: [],
      id: "board-1",
      items: [
        {
          caption: "Edited",
          createdAt: timestamp,
          id: "v1",
          kind: "Visual",
          origin: {
            attachmentVersionId: "version-1",
            kind: "File Attachment version",
          },
          position: 0,
          updatedAt: timestamp,
          view: { crop: null, rotation: 90 },
        },
        {
          caption: null,
          createdAt: timestamp,
          id: "v2",
          kind: "Visual",
          origin: { kind: "External link", url: "https://example.com/x.png" },
          position: 1,
          updatedAt: timestamp,
          view: DEFAULT_VISUAL_VIEW,
        },
      ],
      paletteGroups: [],
      projectId: "project-1",
      revision: 2,
      title: "Direction",
      updatedAt: timestamp,
    };
    const sourcesBefore = structuredClone(board);
    const reads: string[] = [];
    let captured: { tiles: { kind: string }[] }[] = [];

    const output = await buildMoodboardSnapshotOutput(
      board,
      { format: "PNG", itemIds: ["v1", "v2"] },
      {
        loadOriginalBytes: (versionId) => {
          reads.push(versionId);
          return Promise.resolve(original);
        },
        now: () => new Date("2026-10-19T12:00:00.000Z"),
        renderer: {
          pdf: () => Promise.resolve(new Uint8Array()),
          png: (pages) => {
            captured = [...pages];
            return Promise.resolve(pages.map(() => new Uint8Array([1])));
          },
        },
      },
    );

    expect(reads).toEqual(["version-1"]);
    expect(captured[0]?.tiles.map(({ kind }) => kind)).toEqual([
      "image",
      "placeholder",
    ]);
    expect(output.preview.transforms).toHaveLength(1);
    expect(board).toEqual(sourcesBefore);
    expect(digest(original)).toBe(originalBefore);
  });
});

describe("Playwright snapshot renderer", () => {
  test("produces one PDF page per snapshot page and one PNG per page", async () => {
    const pages = [1, 2, 3].map((pageNumber) => ({
      generatedOn: "2026-10-19",
      moment: "Direction as of 2026-10-19, revision 1",
      pageNumber,
      sectionTitle: "Visuals",
      tiles: [{ color: "#AA0000", kind: "swatch" as const, note: null }],
      totalPages: 3,
    }));

    let pdf: Uint8Array;
    let pngs: Uint8Array[];
    try {
      pdf = await playwrightSnapshotRenderer.pdf(pages);
      pngs = await playwrightSnapshotRenderer.png(pages);
    } catch (error) {
      if (String(error).includes("Executable doesn't exist")) {
        return; // Chromium is not installed in this environment.
      }
      throw error;
    }

    expect(
      Buffer.from(pdf)
        .toString("latin1")
        .match(/\/Type\s*\/Page\b/g),
    ).toHaveLength(3);
    expect(pngs).toHaveLength(3);
    expect(
      Buffer.from(pngs[0] ?? [])
        .subarray(1, 4)
        .toString(),
    ).toBe("PNG");
  }, 60_000);
});
