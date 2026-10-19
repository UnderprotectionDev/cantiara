// biome-ignore-all lint/suspicious/noBitwiseOperators: FNV-1a content digest needs 32-bit integer arithmetic.
import {
  parseWireframeDocument,
  type WireframeDocument,
} from "@cantiara/api/wireframe-document";

/**
 * Exports and Presentation Mode read an exact Wireframe version, never the live
 * editing state.
 *
 * How "exact" is guaranteed (no schema change): a snapshot is pinned to an
 * explicit version number and carries the stored document of that version,
 * parsed through the canonical `WireframeDocument` migrator (so Konva JSON is
 * rejected). Live Markdown text is rendered from the version's `visibleText`,
 * never resolved again, so the same version always renders the same output.
 * Geometry saves rewrite the latest ("working") version in place, so only a
 * version that has a newer sibling is sealed. A working version can still be
 * exported, but the manifest says `working` and carries a content digest so a
 * later difference is detectable; `Save Version` is what seals it.
 */
export interface WireframeSnapshot {
  digest: string;
  document: WireframeDocument;
  screenId: string;
  /** `true` when a newer Wireframe version exists, so this one can no longer change. */
  sealed: boolean;
  title: string;
  version: number;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Deterministic 64-bit content digest (two FNV-1a lanes) of the canonical document. */
export function digestWireframeDocument(document: WireframeDocument): string {
  const text = canonicalJson(document);
  let first = 0x81_1c_9d_c5;
  let second = 0x1b_87_35_93;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01_00_01_93) >>> 0;
    second = Math.imul(second ^ code, 0x85_eb_ca_6b) >>> 0;
  }
  return `${first.toString(16).padStart(8, "0")}${second
    .toString(16)
    .padStart(8, "0")}`;
}

export function createWireframeSnapshot(input: {
  document: unknown;
  latestVersion: number;
  screenId: string;
  title: string;
  version: number;
}): WireframeSnapshot {
  const document = parseWireframeDocument(input.document);
  return {
    digest: digestWireframeDocument(document),
    document,
    screenId: input.screenId,
    sealed: input.version < input.latestVersion,
    title: input.title,
    version: input.version,
  };
}
