import { createHash } from "node:crypto";

import {
  credentialClassOf,
  stripSecrets,
} from "@cantiara/api/data-export-secrets";
import {
  EXIT_CONTENT_FAMILIES,
  EXIT_EXCLUDED_CLASSES,
  EXIT_NATURE_NOTE,
  EXIT_PACKAGE_FORMAT,
  EXIT_PACKAGE_MANIFEST_PATH,
  EXIT_PACKAGE_MANIFEST_VERSION,
  EXIT_RESIDENCY_NOTE,
  type ExitManifest,
  ExitPackageError,
  type ExitSourceFile,
  exitManifestSchema,
} from "@cantiara/api/workspace-exit-package";

/**
 * Closes the world over what a source hands in and lays it out as one
 * application-free container: `u32be manifestLength | manifest JSON | file
 * bytes in manifest order`. The container is the envelope's plaintext; this
 * module never encrypts and never writes anywhere.
 */

const REMOVED_LINE = "[removed: Secret class value]";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface AssembledExitPackage {
  files: { bytes: Uint8Array; path: string }[];
  manifest: ExitManifest;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertSafePath(path: string): void {
  const segments = path.split("/");
  const unsafe =
    path === "" ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path === EXIT_PACKAGE_MANIFEST_PATH ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    );
  if (unsafe) {
    throw new ExitPackageError(
      "invalid_path",
      "A package path must be relative and clean.",
    );
  }
}

function cleanFile(file: ExitSourceFile, removed: Set<string>): Uint8Array {
  if (file.kind === "binary") {
    return typeof file.content === "string"
      ? encoder.encode(file.content)
      : file.content;
  }
  const text =
    typeof file.content === "string"
      ? file.content
      : decoder.decode(file.content);
  if (file.kind === "json") {
    return encoder.encode(
      JSON.stringify(stripSecrets(JSON.parse(text), removed), null, 2),
    );
  }
  const lines = text.split("\n").map((line) => {
    const found = credentialClassOf(line);
    if (found) {
      removed.add(`value: ${found}`);
      return REMOVED_LINE;
    }
    return line;
  });
  return encoder.encode(lines.join("\n"));
}

export function assembleExitPackage(
  source: ExitSourceFile[],
  producedAt: Date,
): AssembledExitPackage {
  const removed = new Set<string>();
  const seen = new Set<string>();
  const files: AssembledExitPackage["files"] = [];
  const entries: ExitManifest["files"] = [];
  const sorted = [...source].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  for (const file of sorted) {
    if (file.excludedClass) {
      continue;
    }
    assertSafePath(file.path);
    if (seen.has(file.path)) {
      throw new ExitPackageError(
        "invalid_path",
        "A package path appears twice.",
      );
    }
    seen.add(file.path);
    const bytes = cleanFile(file, removed);
    files.push({ bytes, path: file.path });
    entries.push({
      family: file.family,
      kind: file.kind,
      path: file.path,
      sha256: sha256(bytes),
      size: bytes.byteLength,
    });
  }
  const manifest: ExitManifest = {
    excludedClasses: [...EXIT_EXCLUDED_CLASSES],
    families: EXIT_CONTENT_FAMILIES.map((family) => ({
      family,
      fileCount: entries.filter((entry) => entry.family === family).length,
    })),
    files: entries,
    format: EXIT_PACKAGE_FORMAT,
    manifestVersion: EXIT_PACKAGE_MANIFEST_VERSION,
    nature: EXIT_NATURE_NOTE,
    producedAt: producedAt.toISOString(),
    removedSecretKeys: [...removed].sort(),
    residency: EXIT_RESIDENCY_NOTE,
  };
  return { files, manifest };
}

export function packExitPackage(assembled: AssembledExitPackage): Uint8Array {
  const manifestBytes = encoder.encode(JSON.stringify(assembled.manifest));
  const total =
    4 +
    manifestBytes.byteLength +
    assembled.files.reduce((sum, file) => sum + file.bytes.byteLength, 0);
  const out = new Uint8Array(total);
  new DataView(out.buffer).setUint32(0, manifestBytes.byteLength);
  out.set(manifestBytes, 4);
  let offset = 4 + manifestBytes.byteLength;
  for (const file of assembled.files) {
    out.set(file.bytes, offset);
    offset += file.bytes.byteLength;
  }
  return out;
}

/** Verifier side of the published layout; also used by the test harness. */
export function unpackExitPackage(payload: Uint8Array): AssembledExitPackage {
  if (payload.byteLength < 4) {
    throw new ExitPackageError(
      "package_unreadable",
      "The package is truncated.",
    );
  }
  const manifestLength = new DataView(
    payload.buffer,
    payload.byteOffset,
  ).getUint32(0);
  const parsed = exitManifestSchema.safeParse(
    JSON.parse(decoder.decode(payload.subarray(4, 4 + manifestLength))),
  );
  if (!parsed.success) {
    throw new ExitPackageError(
      "package_unreadable",
      "The manifest is invalid.",
    );
  }
  const manifest = parsed.data;
  let offset = 4 + manifestLength;
  const files: AssembledExitPackage["files"] = [];
  for (const entry of manifest.files) {
    const bytes = payload.slice(offset, offset + entry.size);
    if (bytes.byteLength !== entry.size || sha256(bytes) !== entry.sha256) {
      throw new ExitPackageError(
        "package_unreadable",
        "A file does not match its manifest entry.",
      );
    }
    files.push({ bytes, path: entry.path });
    offset += entry.size;
  }
  return { files, manifest };
}
