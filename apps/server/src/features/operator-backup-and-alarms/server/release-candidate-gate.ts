import type { RegionVerification } from "./eu-deployment-region";
import type { S1TimingEvidence } from "./operational-alarms";
import { S1_ALARM_TARGET_MS } from "./operational-alarms";
import type { RpoDrillResult } from "./operator-backup";
import type { RestoreDrillEvidence } from "./operator-restore";

/**
 * Last release candidate gate (spec 85, PRD 16 `urun-surum-adayi-kaniti`
 * item 12, Operasyonel kurtarma). A Product release candidate evidence package
 * is accepted only when it carries a verified operational recovery result:
 * a restore drill inside RPO and RTO, S1 timing inside five minutes, and an approved EU region verification. Anything missing or
 * failing blocks the candidate; the feature phase never defers this gate.
 */

export type RcBlockReason =
  | "RECOVERY_RESULT_MISSING"
  | "REGION_NOT_VERIFIED"
  | "REGION_VERIFICATION_MISSING"
  | "RESTORE_DRILL_MISSING"
  | "RPO_EVIDENCE_MISSING"
  | "RPO_OUTSIDE_TARGET"
  | "RTO_OUTSIDE_TARGET"
  | "S1_CONTAINMENT_FAILED"
  | "S1_EVIDENCE_MISSING"
  | "S1_OUTSIDE_TARGET";

export interface OperationalRecoveryEvidence {
  region?: RegionVerification;
  restore?: RestoreDrillEvidence;
  rpo?: RpoDrillResult;
  s1?: S1TimingEvidence;
}

/** The slice of the release candidate package this gate reads. */
export interface ReleaseCandidateEvidencePackage {
  operationalRecovery?: OperationalRecoveryEvidence;
}

export type ReleaseCandidateDecision =
  | { reasons: readonly []; status: "accepted" }
  | { reasons: readonly RcBlockReason[]; status: "blocked" };

export function evaluateReleaseCandidate(
  evidencePackage: ReleaseCandidateEvidencePackage,
): ReleaseCandidateDecision {
  const evidence = evidencePackage.operationalRecovery;
  if (!evidence) {
    return { reasons: ["RECOVERY_RESULT_MISSING"], status: "blocked" };
  }
  const reasons: RcBlockReason[] = [];

  if (!evidence.restore) {
    reasons.push("RESTORE_DRILL_MISSING");
  } else if (!evidence.restore.rtoWithinTarget) {
    reasons.push("RTO_OUTSIDE_TARGET");
  }

  if (!evidence.rpo) {
    reasons.push("RPO_EVIDENCE_MISSING");
  } else if (!evidence.rpo.withinTarget) {
    reasons.push("RPO_OUTSIDE_TARGET");
  }

  if (evidence.s1) {
    if (
      !evidence.s1.withinTarget ||
      evidence.s1.latencyMs > S1_ALARM_TARGET_MS
    ) {
      reasons.push("S1_OUTSIDE_TARGET");
    }
    if (evidence.s1.containment === "containment-failed") {
      reasons.push("S1_CONTAINMENT_FAILED");
    }
  } else {
    reasons.push("S1_EVIDENCE_MISSING");
  }

  if (!evidence.region) {
    reasons.push("REGION_VERIFICATION_MISSING");
  } else if (!evidence.region.ok) {
    reasons.push("REGION_NOT_VERIFIED");
  }

  return reasons.length === 0
    ? { reasons: [], status: "accepted" }
    : { reasons, status: "blocked" };
}
