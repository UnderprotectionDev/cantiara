import {
  EXIT_CONTENT_FAMILIES,
  EXIT_EXCLUDED_CLASSES,
  ExitPackageError,
  type ExitSourceFile,
} from "@cantiara/api/workspace-exit-package";
import { describe, expect, test } from "vitest";

import {
  assembleExitPackage,
  packExitPackage,
  unpackExitPackage,
} from "../exit-package-archive";

const at = new Date("2026-10-31T10:00:00Z");
const binary = new Uint8Array([0, 1, 2, 250, 251, 252]);

const fixture: ExitSourceFile[] = [
  {
    content: "# Spec\n\nBody",
    family: "content",
    kind: "markdown",
    path: "content/documents/spec.md",
  },
  {
    content: JSON.stringify({ id: "w1", title: "Work" }),
    family: "content",
    kind: "json",
    path: "content/work/w1.json",
  },
  {
    content: binary,
    family: "attachment-versions",
    kind: "binary",
    path: "attachments/a1/v1/logo.png",
  },
  {
    content: JSON.stringify({ id: "a1", versions: [1, 2] }),
    family: "attachment-versions",
    kind: "json",
    path: "attachments/a1/versions.json",
  },
  {
    content: JSON.stringify({ owner: "u1" }),
    family: "identities",
    kind: "json",
    path: "identities/account.json",
  },
  {
    content: JSON.stringify([{ from: "w1", to: "d1" }]),
    family: "relations",
    kind: "json",
    path: "relations/relations.json",
  },
  {
    content: JSON.stringify([{ at: "2026-01-01", event: "created" }]),
    family: "history",
    kind: "json",
    path: "history/events.json",
  },
  {
    content: JSON.stringify({ density: "compact" }),
    family: "configuration",
    kind: "json",
    path: "configuration/preferences.json",
  },
];

describe("Workspace Exit Package archive", () => {
  test("carries every content family as readable files plus original binaries and one manifest", () => {
    const { files, manifest } = assembleExitPackage(fixture, at);
    for (const family of EXIT_CONTENT_FAMILIES) {
      expect(
        manifest.families.find((entry) => entry.family === family)?.fileCount,
      ).toBeGreaterThan(0);
    }
    expect(manifest.files.map((file) => file.path)).toEqual(
      files.map((file) => file.path),
    );
    expect(files.find((file) => file.path.endsWith("logo.png"))?.bytes).toEqual(
      binary,
    );
    expect(
      manifest.files.find((file) => file.path.endsWith("spec.md"))?.kind,
    ).toBe("markdown");
  });

  test("drops every excluded class and names them in the manifest", () => {
    const tagged: ExitSourceFile[] = EXIT_EXCLUDED_CLASSES.map(
      (excludedClass) => ({
        content: "x",
        excludedClass,
        family: "content",
        kind: "markdown",
        path: `leak/${excludedClass}.md`,
      }),
    );
    const { manifest } = assembleExitPackage([...fixture, ...tagged], at);
    expect(manifest.files.some((file) => file.path.startsWith("leak/"))).toBe(
      false,
    );
    expect(manifest.excludedClasses).toEqual([...EXIT_EXCLUDED_CLASSES]);
  });

  test("strips Secret class values from JSON and Markdown even when a source forgets to tag them", () => {
    const token = `ghp_${"a1B2c3D4e5F6g7H8i9J0k1L2"}`;
    const { files, manifest } = assembleExitPackage(
      [
        {
          content: JSON.stringify({
            id: "i1",
            sessionToken: "s3cret",
            note: token,
          }),
          family: "configuration",
          kind: "json",
          path: "configuration/integration.json",
        },
        {
          content: `fine line\nkey ${token}\nlast`,
          family: "content",
          kind: "markdown",
          path: "content/note.md",
        },
      ],
      at,
    );
    const text = files
      .map((file) => new TextDecoder().decode(file.bytes))
      .join("\n");
    expect(text).not.toContain(token);
    expect(text).not.toContain("s3cret");
    expect(text).toContain("fine line");
    expect(manifest.removedSecretKeys.length).toBeGreaterThan(0);
  });

  test("is not a Selected Export or a backup, and keeps live EU residency", () => {
    const { manifest } = assembleExitPackage(fixture, at);
    expect(manifest.nature).toContain("not a Selected Export");
    expect(manifest.residency).toContain("stays in the EU");
  });

  test("refuses unsafe or duplicate paths", () => {
    for (const path of [
      "../x.md",
      "/abs.md",
      "a//b.md",
      "manifest.json",
      "a\\b.md",
    ]) {
      expect(() =>
        assembleExitPackage(
          [{ content: "x", family: "content", kind: "markdown", path }],
          at,
        ),
      ).toThrow(ExitPackageError);
    }
    const twice: ExitSourceFile = {
      content: "x",
      family: "content",
      kind: "markdown",
      path: "a.md",
    };
    expect(() => assembleExitPackage([twice, twice], at)).toThrow(
      ExitPackageError,
    );
  });

  test("round-trips through the published container layout and detects tampering", () => {
    const packed = packExitPackage(assembleExitPackage(fixture, at));
    const unpacked = unpackExitPackage(packed);
    expect(unpacked.files).toHaveLength(fixture.length);
    const tampered = packed.slice();
    tampered[tampered.length - 1] = ((tampered.at(-1) ?? 0) + 1) % 256;
    expect(() => unpackExitPackage(tampered)).toThrow(ExitPackageError);
  });
});
