import type { ExternalAccessGateController } from "./restore-access-gate";

/**
 * Metrics, alarms and the S1/S2 pipeline (spec 85, PRD 03 `hizmet-isletimi`,
 * ADR-0010). Better Stack is the alarm adapter behind `AlarmNotifierPort`.
 *
 * - S1 is raised at most five minutes after an automatic detection. Safe
 *   fail-closed containment starts BEFORE delivery and never waits for a
 *   human. Exceeding five minutes is an operational error record, not a
 *   Production Incident (spec 66 is a different record and is not imported).
 * - S2 carries a one-business-day triage deadline.
 * - There is no 24/7 on-call, pager or customer support queue here.
 */

export const S1_ALARM_TARGET_MS = 5 * 60 * 1000;

export type AlarmMetric =
  | "backup-failure"
  | "error-rate"
  | "health"
  | "queue-latency";

export type AlarmSeverity = "S1" | "S2";

export type ContainmentAction = "close-external-access" | "none";

export interface AlarmDefinition {
  /** Fail-closed action that is safe to take without a human. */
  containment: ContainmentAction;
  metric: AlarmMetric;
  /** Value at or above which the severity applies; omitted = never. */
  s1AtOrAbove?: number;
  s2AtOrAbove?: number;
  unit: "bool" | "ms" | "ratio";
}

/** Structured metric and alarm definitions (health 0/1: 1 = unhealthy). */
export const ALARM_DEFINITIONS: Readonly<Record<AlarmMetric, AlarmDefinition>> =
  {
    "backup-failure": {
      containment: "none",
      metric: "backup-failure",
      s1AtOrAbove: 1,
      unit: "bool",
    },
    "error-rate": {
      containment: "close-external-access",
      metric: "error-rate",
      s1AtOrAbove: 0.25,
      s2AtOrAbove: 0.05,
      unit: "ratio",
    },
    health: {
      containment: "close-external-access",
      metric: "health",
      s1AtOrAbove: 1,
      unit: "bool",
    },
    "queue-latency": {
      containment: "none",
      metric: "queue-latency",
      s1AtOrAbove: 60 * 60 * 1000,
      s2AtOrAbove: 10 * 60 * 1000,
      unit: "ms",
    },
  };

export interface AlarmDetection {
  detectedAt: string;
  metric: AlarmMetric;
  value: number;
}

export interface OperationalAlarm {
  containment: ContainmentAction;
  detectedAt: string;
  id: string;
  latencyMs: number;
  metric: AlarmMetric;
  raisedAt: string;
  severity: AlarmSeverity;
  /** S2 only: end of the next business day after detection. */
  triageDueAt?: string;
  value: number;
}

export type OperationalErrorCode =
  | "ALARM_DELIVERY_FAILED"
  | "CONTAINMENT_FAILED"
  | "S1_ALARM_LATE";

/** An operational error of the alarm pipeline itself; never a spec 66 record. */
export interface OperationalErrorRecord {
  alarmId: string;
  at: string;
  code: OperationalErrorCode;
  details: readonly string[];
}

/** Better Stack is the adapter; the real client lives outside this seam. */
export interface AlarmNotifierPort {
  raise: (alarm: OperationalAlarm) => Promise<void>;
}

export interface AlarmStorePort {
  saveAlarm: (alarm: OperationalAlarm) => Promise<void>;
  saveOperationalError: (error: OperationalErrorRecord) => Promise<void>;
}

export interface OperationalAlarmDeps {
  gate: ExternalAccessGateController;
  newAlarmId: () => string;
  notifier: AlarmNotifierPort;
  now: () => Date;
  store: AlarmStorePort;
}

export function classifySeverity(
  detection: Pick<AlarmDetection, "metric" | "value">,
): AlarmSeverity | null {
  const definition = ALARM_DEFINITIONS[detection.metric];
  if (
    definition.s1AtOrAbove !== undefined &&
    detection.value >= definition.s1AtOrAbove
  ) {
    return "S1";
  }
  if (
    definition.s2AtOrAbove !== undefined &&
    detection.value >= definition.s2AtOrAbove
  ) {
    return "S2";
  }
  return null;
}

/** End of the next business day (UTC), skipping Saturday and Sunday. */
export function triageDeadline(detectedAt: Date): Date {
  const due = new Date(detectedAt);
  do {
    due.setUTCDate(due.getUTCDate() + 1);
  } while (due.getUTCDay() === 0 || due.getUTCDay() === 6);
  due.setUTCHours(23, 59, 59, 999);
  return due;
}

export function createOperationalAlarms(deps: OperationalAlarmDeps) {
  async function recordError(
    alarmId: string,
    code: OperationalErrorCode,
    details: readonly string[],
  ) {
    await deps.store.saveOperationalError({
      alarmId,
      at: deps.now().toISOString(),
      code,
      details,
    });
  }

  function contain(
    definition: AlarmDefinition,
    alarmId: string,
  ): Promise<void> {
    if (definition.containment !== "close-external-access") {
      return Promise.resolve();
    }
    try {
      // No human approval: the closed gate is the safe default.
      deps.gate.close(`s1-containment:${definition.metric}`);
      return Promise.resolve();
    } catch (cause) {
      return recordError(alarmId, "CONTAINMENT_FAILED", [
        cause instanceof Error ? cause.name : "UNKNOWN",
      ]);
    }
  }

  return {
    /**
     * Turns one automatic detection into an alarm. Never throws: delivery
     * failure and lateness are operational error records.
     */
    async handle(detection: AlarmDetection): Promise<OperationalAlarm | null> {
      const severity = classifySeverity(detection);
      if (!severity) {
        return null;
      }
      const definition = ALARM_DEFINITIONS[detection.metric];
      const id = deps.newAlarmId();
      const detectedAt = new Date(detection.detectedAt);

      if (severity === "S1") {
        await contain(definition, id);
      }

      const raisedAt = deps.now();
      const alarm: OperationalAlarm = {
        containment: severity === "S1" ? definition.containment : "none",
        detectedAt: detectedAt.toISOString(),
        id,
        latencyMs: raisedAt.getTime() - detectedAt.getTime(),
        metric: detection.metric,
        raisedAt: raisedAt.toISOString(),
        severity,
        value: detection.value,
        ...(severity === "S2"
          ? { triageDueAt: triageDeadline(detectedAt).toISOString() }
          : {}),
      };
      await deps.store.saveAlarm(alarm);
      if (severity === "S1" && alarm.latencyMs > S1_ALARM_TARGET_MS) {
        await recordError(id, "S1_ALARM_LATE", [
          `latencyMs:${alarm.latencyMs}`,
        ]);
      }
      try {
        await deps.notifier.raise(alarm);
      } catch (cause) {
        await recordError(id, "ALARM_DELIVERY_FAILED", [
          cause instanceof Error ? cause.name : "UNKNOWN",
        ]);
      }
      return alarm;
    },
  };
}

export type OperationalAlarms = ReturnType<typeof createOperationalAlarms>;

/** S1 timing evidence the release candidate gate reads (item 12). */
export interface S1TimingEvidence {
  /** Fail-closed action taken without waiting for a human. */
  containment: ContainmentAction;
  detectedAt: string;
  latencyMs: number;
  raisedAt: string;
  withinTarget: boolean;
}

export function s1TimingEvidenceOf(
  alarm: OperationalAlarm,
): S1TimingEvidence | null {
  if (alarm.severity !== "S1") {
    return null;
  }
  return {
    containment: alarm.containment,
    detectedAt: alarm.detectedAt,
    latencyMs: alarm.latencyMs,
    raisedAt: alarm.raisedAt,
    withinTarget: alarm.latencyMs <= S1_ALARM_TARGET_MS,
  };
}
