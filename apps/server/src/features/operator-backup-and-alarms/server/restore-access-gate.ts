/**
 * External access gate for restore (spec 85, PRD 03 operasyonel yedek ve
 * kurtarma). While the gate is closed no External Surface, visitor session or
 * origin/asset is served. It starts closed (fail-closed default), the restore
 * runner closes it before touching anything and is the only holder of the
 * controller that can open it, and only after replay, integrity and the
 * post-replay denial check all passed. Edge code reads the read-only `gate`.
 */

export type ExternalAccessKind =
  | "external-surface"
  | "origin-asset"
  | "visitor-session";

export type GateStatus =
  | { open: false; reason: string }
  | { open: true; reason: "restore-verified" | "normal-operation" };

export interface ExternalAccessGate {
  allows: (kind: ExternalAccessKind) => boolean;
  status: () => GateStatus;
}

export interface ExternalAccessGateController {
  close: (reason: string) => void;
  open: (reason: "restore-verified" | "normal-operation") => void;
}

export function createExternalAccessGate(
  initial: GateStatus = { open: false, reason: "restore-pending" },
): { controller: ExternalAccessGateController; gate: ExternalAccessGate } {
  let current: GateStatus = initial;
  return {
    controller: {
      close(reason) {
        current = { open: false, reason };
      },
      open(reason) {
        current = { open: true, reason };
      },
    },
    gate: {
      allows: () => current.open,
      status: () => current,
    },
  };
}
