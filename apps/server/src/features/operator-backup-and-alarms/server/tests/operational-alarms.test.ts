import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  assertDeploymentRegion,
  DeploymentRegionError,
  deploymentRegionFromEnv,
  verifyDeploymentRegion,
} from "../eu-deployment-region";
import {
  ALARM_DEFINITIONS,
  type AlarmDetection,
  classifySeverity,
  createOperationalAlarms,
  S1_ALARM_TARGET_MS,
  s1TimingEvidenceOf,
  triageDeadline,
} from "../operational-alarms";
import type { RestoreDrillEvidence } from "../operator-restore";
import {
  evaluateReleaseCandidate,
  type OperationalRecoveryEvidence,
} from "../release-candidate-gate";
import { createAlarmWorld } from "./operational-alarms-memory";

const MINUTE = 60 * 1000;
const IMPORT_LINE = /^\s*import\b|from\s+["']/;
const PRODUCTION_INCIDENT = /production-incident/i;
const FORBIDDEN_EXPORT =
  /export\s+(?:const|function|interface|type)\s+\w*(?:Pager|OnCall|SupportQueue|ProductionIncident)/i;

function setup() {
  const world = createAlarmWorld();
  const alarms = createOperationalAlarms({
    gate: world.controller,
    newAlarmId: world.newAlarmId,
    notifier: world.notifier,
    now: world.now,
    store: world.store,
  });
  const detect = (
    metric: AlarmDetection["metric"],
    value: number,
    agoMs = 0,
  ): AlarmDetection => ({
    detectedAt: new Date(world.now().getTime() - agoMs).toISOString(),
    metric,
    value,
  });
  return { alarms, detect, world };
}

describe("Operator Backup and Alarms: metric and alarm definitions", () => {
  test("health, error rate, queue latency and backup failure are defined", () => {
    expect(Object.keys(ALARM_DEFINITIONS).sort()).toEqual([
      "backup-failure",
      "error-rate",
      "health",
      "queue-latency",
    ]);
  });

  test("values below thresholds raise nothing", async () => {
    const { alarms, detect, world } = setup();
    expect(classifySeverity({ metric: "error-rate", value: 0.01 })).toBeNull();
    expect(await alarms.handle(detect("error-rate", 0.01))).toBeNull();
    expect(world.alarms).toEqual([]);
  });
});

describe("Operator Backup and Alarms: S1 within five minutes", () => {
  test("an injected health detection yields an S1 alarm inside five minutes", async () => {
    const { alarms, detect, world } = setup();
    world.advance(0);
    const alarm = await alarms.handle(detect("health", 1, 30 * 1000));
    expect(alarm?.severity).toBe("S1");
    expect(alarm?.latencyMs).toBe(30 * 1000);
    expect(world.delivered).toHaveLength(1);
    expect(world.errors).toEqual([]);
    const evidence = alarm ? s1TimingEvidenceOf(alarm) : null;
    expect(evidence?.withinTarget).toBe(true);
  });

  test("containment closes external access without a human", async () => {
    const { alarms, detect, world } = setup();
    expect(world.gate.allows("external-surface")).toBe(true);
    await alarms.handle(detect("health", 1));
    expect(world.gate.allows("external-surface")).toBe(false);
    expect(world.gate.status()).toEqual({
      open: false,
      reason: "s1-containment:health",
    });
  });

  test("containment starts even when delivery fails, and failure is an operational error", async () => {
    const { alarms, detect, world } = setup();
    world.faults.deliveryFails = true;
    const alarm = await alarms.handle(detect("error-rate", 0.5));
    expect(alarm?.severity).toBe("S1");
    expect(world.gate.allows("visitor-session")).toBe(false);
    expect(world.errors.map((e) => e.code)).toEqual(["ALARM_DELIVERY_FAILED"]);
  });

  test("exceeding five minutes is an operational error, not a Production Incident", async () => {
    const { alarms, detect, world } = setup();
    const alarm = await alarms.handle(
      detect("health", 1, S1_ALARM_TARGET_MS + MINUTE),
    );
    expect(alarm?.latencyMs).toBe(6 * MINUTE);
    expect(world.errors).toEqual([
      expect.objectContaining({ alarmId: alarm?.id, code: "S1_ALARM_LATE" }),
    ]);
    expect(alarm ? s1TimingEvidence(alarm) : null).toBe(false);
    // Containment still ran.
    expect(world.gate.allows("external-surface")).toBe(false);
  });

  test("a backup failure is an S1 that needs no access closure", async () => {
    const { alarms, detect, world } = setup();
    const alarm = await alarms.handle(detect("backup-failure", 1));
    expect(alarm?.severity).toBe("S1");
    expect(alarm?.containment).toBe("none");
    expect(world.gate.allows("external-surface")).toBe(true);
  });
});

function s1TimingEvidence(alarm: Parameters<typeof s1TimingEvidenceOf>[0]) {
  return s1TimingEvidenceOf(alarm)?.withinTarget ?? null;
}

describe("Operator Backup and Alarms: S2", () => {
  test("S2 carries a one-business-day triage deadline and no containment", async () => {
    const { alarms, detect, world } = setup();
    // 2026-11-02 is a Monday.
    const alarm = await alarms.handle(detect("queue-latency", 15 * MINUTE));
    expect(alarm?.severity).toBe("S2");
    expect(alarm?.triageDueAt).toBe("2026-11-03T23:59:59.999Z");
    expect(world.gate.allows("external-surface")).toBe(true);
    expect(world.errors).toEqual([]);
  });

  test("a Friday S2 is due on Monday", () => {
    expect(
      triageDeadline(new Date("2026-11-06T16:00:00.000Z")).toISOString(),
    ).toBe("2026-11-09T23:59:59.999Z");
  });

  test("an alarm record carries no on-call, support queue or incident fields", async () => {
    const { alarms, detect } = setup();
    const alarm = await alarms.handle(detect("queue-latency", 15 * MINUTE));
    expect(Object.keys(alarm ?? {}).sort()).toEqual([
      "containment",
      "detectedAt",
      "id",
      "latencyMs",
      "metric",
      "raisedAt",
      "severity",
      "triageDueAt",
      "value",
    ]);
  });
});

const goodRestore = {
  rtoMs: 3_600_000,
  rtoWithinTarget: true,
} as RestoreDrillEvidence;

const goodRegion = verifyDeploymentRegion({
  betterStackRegion: "germany",
  neonHosts: ["ep-a.eu-central-1.aws.neon.tech"],
  r2Jurisdiction: "eu",
  railwayRegion: "europe-west4-drams3a",
});

function goodEvidence(): OperationalRecoveryEvidence {
  return {
    region: goodRegion,
    restore: goodRestore,
    rpo: { lossMs: 4 * MINUTE, runs: 3, verifiedRuns: 3, withinTarget: true },
    s1: {
      containment: "close-external-access",
      detectedAt: "2026-11-02T10:00:00.000Z",
      latencyMs: MINUTE,
      raisedAt: "2026-11-02T10:01:00.000Z",
      withinTarget: true,
    },
  };
}

describe("Operator Backup and Alarms: release candidate gate (item 12)", () => {
  test("verified recovery, S1 timing and region accept the candidate", () => {
    expect(
      evaluateReleaseCandidate({ operationalRecovery: goodEvidence() }),
    ).toEqual({ reasons: [], status: "accepted" });
  });

  test("a package without the operational recovery result is blocked", () => {
    expect(evaluateReleaseCandidate({})).toEqual({
      reasons: ["RECOVERY_RESULT_MISSING"],
      status: "blocked",
    });
  });

  test.each([
    ["restore", "RESTORE_DRILL_MISSING"],
    ["rpo", "RPO_EVIDENCE_MISSING"],
    ["s1", "S1_EVIDENCE_MISSING"],
    ["region", "REGION_VERIFICATION_MISSING"],
  ] as const)("missing %s evidence blocks", (key, reason) => {
    const evidence = goodEvidence();
    delete evidence[key];
    expect(evaluateReleaseCandidate({ operationalRecovery: evidence })).toEqual(
      { reasons: [reason], status: "blocked" },
    );
  });

  test("RTO, RPO, S1 and region failures block", () => {
    const evidence = goodEvidence();
    evidence.restore = { ...goodRestore, rtoWithinTarget: false };
    evidence.rpo = {
      lossMs: 9 * MINUTE,
      runs: 1,
      verifiedRuns: 0,
      withinTarget: false,
    };
    evidence.s1 = {
      ...(evidence.s1 as NonNullable<typeof evidence.s1>),
      latencyMs: 6 * MINUTE,
      withinTarget: false,
    };
    evidence.region = verifyDeploymentRegion({ neonHosts: [] });
    expect(
      evaluateReleaseCandidate({ operationalRecovery: evidence }).reasons,
    ).toEqual([
      "RTO_OUTSIDE_TARGET",
      "RPO_OUTSIDE_TARGET",
      "S1_OUTSIDE_TARGET",
      "REGION_NOT_VERIFIED",
    ]);
  });
});

describe("Operator Backup and Alarms: production EU region assertion", () => {
  const approved = {
    betterStackRegion: "Germany",
    neonHosts: [
      "ep-a.eu-central-1.aws.neon.tech",
      "ep-b.eu-central-1.aws.neon.tech",
    ],
    r2Jurisdiction: "eu",
    railwayRegion: "europe-west4-drams3a",
  };

  test("Neon Frankfurt, Railway Amsterdam, R2 eu and Better Stack Germany pass", () => {
    expect(verifyDeploymentRegion(approved).ok).toBe(true);
    expect(() => assertDeploymentRegion(approved)).not.toThrow();
  });

  test.each([
    ["neon", { neonHosts: ["ep-a.us-east-2.aws.neon.tech"] }],
    ["railway", { railwayRegion: "us-west2" }],
    ["r2", { r2Jurisdiction: "default" }],
    ["better-stack", { betterStackRegion: "us" }],
  ] as const)("%s outside the EU region fails closed", (provider, override) => {
    const verification = verifyDeploymentRegion({ ...approved, ...override });
    expect(verification.ok).toBe(false);
    expect(verification.violations).toEqual([
      expect.objectContaining({
        provider,
        reason: "OUTSIDE_APPROVED_REGION",
      }),
    ]);
    expect(() => assertDeploymentRegion({ ...approved, ...override })).toThrow(
      DeploymentRegionError,
    );
  });

  test("an unset provider is unverifiable, never approved", () => {
    const verification = verifyDeploymentRegion({ neonHosts: [] });
    expect(verification.violations.map((v) => v.provider).sort()).toEqual([
      "better-stack",
      "neon",
      "r2",
      "railway",
    ]);
    expect(
      verification.violations.every((v) => v.reason === "UNVERIFIABLE"),
    ).toBe(true);
  });

  test("the environment reader takes host names only, never credentials", () => {
    const config = deploymentRegionFromEnv({
      BETTER_STACK_REGION: "germany",
      DATABASE_URL: "postgres://user:secret@ep-a.eu-central-1.aws.neon.tech/db",
      R2_JURISDICTION: "eu",
      RAILWAY_REPLICA_REGION: "europe-west4-drams3a",
      SECURITY_EVENT_DATABASE_URL:
        "postgres://other:pw@ep-b.eu-central-1.aws.neon.tech/db",
    });
    expect(JSON.stringify(config)).not.toContain("secret");
    expect(verifyDeploymentRegion(config).ok).toBe(true);
  });
});

describe("Operator Backup and Alarms: S1 is not a Production Incident", () => {
  const featureDir = join(import.meta.dirname, "..");
  const files = readdirSync(featureDir).filter((name) => name.endsWith(".ts"));

  test("no feature file imports production-incidents", () => {
    const offenders = files.filter((name) =>
      readFileSync(join(featureDir, name), "utf8")
        .split("\n")
        .some(
          (line) => IMPORT_LINE.test(line) && PRODUCTION_INCIDENT.test(line),
        ),
    );
    expect(offenders).toEqual([]);
  });

  test("no pager, on-call or support queue is exported by the alarm pipeline", () => {
    const source = readFileSync(
      join(featureDir, "operational-alarms.ts"),
      "utf8",
    );
    expect(source).not.toMatch(FORBIDDEN_EXPORT);
  });
});
