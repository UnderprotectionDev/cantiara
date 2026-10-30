import {
  SECURITY_REDACTION_LOCATOR_KINDS,
  type SecurityRedactionLocatorKind,
  type SecurityRedactionSpread,
  SecurityRedactionSpreadIncompleteError,
  type SecurityRedactionTargetAdapter,
  type SecurityRedactionTargetOutcome,
} from "@cantiara/api/security-redaction";

/**
 * The one removal engine of Security Redaction (spec 78 #505): runs every
 * registered target adapter for the closed spread targets. Targets are
 * independent, so one failing store never stops the others; the failure then
 * surfaces as `SecurityRedactionSpreadIncompleteError` that names kinds only.
 * A target with no adapter is reported `not-wired`, never as clean. The
 * sensitive value only reaches the adapters and is never logged or returned.
 * Adapters run in the order given so a delivery cache is cleared after the
 * snapshots it served.
 */
export function createSecurityRedactionSpread(
  adapters: readonly SecurityRedactionTargetAdapter[],
): SecurityRedactionSpread {
  return {
    async spread(request) {
      const outcomes = new Map<
        SecurityRedactionLocatorKind,
        SecurityRedactionTargetOutcome
      >();
      const failed: SecurityRedactionLocatorKind[] = [];
      for (const adapter of adapters) {
        try {
          // biome-ignore lint/performance/noAwaitInLoops: adapters keep their declared order.
          const copies = await adapter.remove(request);
          const total =
            (outcomes.get(adapter.kind)?.copies ?? 0) + (copies ?? 0);
          let status: SecurityRedactionTargetOutcome["status"] =
            "nothing-found";
          if (total > 0) {
            status = "removed";
          } else if (copies === null) {
            status = "no-stored-copy";
          }
          outcomes.set(adapter.kind, {
            copies: total,
            kind: adapter.kind,
            status,
          });
        } catch {
          // A driver message may carry the value: keep the kind only.
          failed.push(adapter.kind);
        }
      }
      if (failed.length > 0) {
        throw new SecurityRedactionSpreadIncompleteError(failed);
      }
      return {
        targets: SECURITY_REDACTION_LOCATOR_KINDS.map(
          (kind): SecurityRedactionTargetOutcome =>
            outcomes.get(kind) ?? { copies: 0, kind, status: "not-wired" },
        ),
      };
    },
  };
}
