import type { TestReportResult } from "./test-report";

/**
 * The closed alias catalog of `test-report/1` (PRD 10, "Sonuç normalizasyon
 * sözleşmesi"). Matching trims outer whitespace and ignores case, nothing more:
 * no stemming, no substring, no sentence reading. Adding an alias is a change
 * to the envelope contract, never a silent remap, and a phrase such as
 * `Checkout flow looks good` is deliberately not here.
 */
export const TEST_REPORT_V1_RESULT_ALIASES: Readonly<
  Record<TestReportResult, readonly string[]>
> = {
  blocked: ["blocked", "block"],
  failed: ["failed", "fail", "failure", "assertion_failed"],
  inconclusive: ["inconclusive", "flaky", "unknown", "mixed"],
  not_reported: ["not_reported", "not reported"],
  passed: ["passed", "pass", "success", "succeeded", "ok"],
  skipped: ["skipped", "skip", "ignored", "not_applicable", "n/a"],
};

const ALIAS_TO_RESULT = new Map<string, TestReportResult>(
  (
    Object.entries(TEST_REPORT_V1_RESULT_ALIASES) as [
      TestReportResult,
      readonly string[],
    ][]
  ).flatMap(([result, aliases]) =>
    aliases.map((alias): [string, TestReportResult] => [alias, result]),
  ),
);

/** The wire value a raw statement names, or `null` when it is outside the catalog. */
export function aliasOfRawResult(raw: string): TestReportResult | null {
  return ALIAS_TO_RESULT.get(raw.trim().toLowerCase()) ?? null;
}

export type NormalizedReportResult =
  | { normalized: TestReportResult; status: "ok" }
  | { status: "conflict" };

/**
 * The normalized layer of one Session Test. The raw statement is stored
 * elsewhere, untouched. An explicit `normalized_result` is kept unless the raw
 * statement plainly names another value (`result_conflict`, never a silent
 * fix); without one, the catalog decides and anything outside it is
 * `not_reported`. Nothing here reads a title, a note or sibling tests, so no
 * session-level verdict can come out of it.
 */
export function normalizeReportedResult(
  raw: string | undefined,
  normalized: TestReportResult | undefined,
): NormalizedReportResult {
  const named = raw === undefined ? null : aliasOfRawResult(raw);
  if (normalized !== undefined) {
    return named !== null && named !== normalized
      ? { status: "conflict" }
      : { normalized, status: "ok" };
  }
  return { normalized: named ?? "not_reported", status: "ok" };
}
