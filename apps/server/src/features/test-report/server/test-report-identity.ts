import { createHash } from "node:crypto";
import type { TestReportV1 } from "@cantiara/api/test-report";
import canonicalize from "canonicalize";

/**
 * Canonical content of a report: key order and JSON whitespace never matter
 * (RFC 8785 via `canonicalize`), times compare as instants, and neither the
 * executor (display attribution) nor any transport metadata is part of it.
 * Referenced File Attachments enter by content hash, so the same id with other
 * bytes is other content.
 */
export function testReportFingerprint(
  report: TestReportV1,
  attachmentHashes: Readonly<Record<string, string>> = {},
) {
  const { executor: _executor, ...content } = report;
  const instant = (value: string | undefined) =>
    value === undefined ? undefined : new Date(value).toISOString();
  const canonical = canonicalize({
    ...content,
    attachment_hashes: Object.fromEntries(Object.entries(attachmentHashes)),
    ended_at: instant(content.ended_at),
    reported_at: instant(content.reported_at),
    started_at: instant(content.started_at),
  });
  return createHash("sha256")
    .update(canonical ?? "")
    .digest("hex");
}
