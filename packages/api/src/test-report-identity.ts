import { createHash } from "node:crypto";
import canonicalize from "canonicalize";
import type { TestReportV1 } from "./test-report";

/**
 * Canonical content of a report: key order and JSON whitespace never matter
 * (RFC 8785 via `canonicalize`), times compare as instants, and neither the
 * executor (display attribution) nor any transport metadata is part of it.
 */
export function testReportFingerprint(report: TestReportV1) {
  const { executor: _executor, ...content } = report;
  const instant = (value: string | undefined) =>
    value === undefined ? undefined : new Date(value).toISOString();
  const canonical = canonicalize({
    ...content,
    ended_at: instant(content.ended_at),
    reported_at: instant(content.reported_at),
    started_at: instant(content.started_at),
  });
  return createHash("sha256")
    .update(canonical ?? "")
    .digest("hex");
}
