import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { productionIncidentLink } from "@cantiara/db/schema/production-incident";
import { describe, expect, test } from "vitest";

import {
  type BugCandidate,
  bugTarget,
  buildFollowUpPlan,
  decisionTarget,
  isBindableBug,
  isBindablePullRequest,
  missingTarget,
  type PullRequestCandidate,
  previewOfFollowUp,
  productionIncidentLinkId,
  pullRequestTarget,
  releaseTarget,
  riskTarget,
} from "../production-incidents";

const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;
const FORBIDDEN_PORT =
  /sentry|pager|on-?call|status ?page|better ?stack|s1[ _-]?alarm|\b(?:ttd|tti|ttr)\b|downtime|slack/i;
const ALARM_OR_ERROR_EVENT = /sentry|better ?stack|s1[ _-]?alarm/i;
const INCIDENT_TABLE_IMPORT = /schema\/production-incident"/;
const INCIDENT_TABLE_WRITE = /\.(insert|update|delete)\(\s*productionIncident/;
const INCIDENT_REFERENCE = /production-incident|productionIncident/;
const TIMING_COLUMN = /ttd|tti|ttr|page|oncall|score|severity/i;
const SERVER_SRC = join(import.meta.dirname, "../../../..");
const FEATURE_DIR = join(import.meta.dirname, "..");

const bug: BugCandidate = {
  archivedAt: null,
  id: "work-1",
  key: "TK-7",
  status: "In Progress",
  title: "Checkout 500s",
  trashedAt: null,
  type: "Bug",
};
const pull: PullRequestCandidate = {
  archivedAt: null,
  id: "pr-1",
  kind: "Pull request",
  number: 42,
  repository: "tidekit",
  sourceState: "merged",
  title: "Fix checkout",
  trashedAt: null,
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "node_modules" || name === "tests"
        ? []
        : sourceFiles(path);
    }
    return SOURCE_FILE.test(name) && !TEST_FILE.test(name) ? [path] : [];
  });
}

describe("Production Incidents seam: what may be bound", () => {
  test("a Bug is a live Work of type Bug, never another Work type", () => {
    expect(isBindableBug(bug)).toBe(true);
    expect(isBindableBug({ ...bug, type: "Task" })).toBe(false);
    expect(isBindableBug({ ...bug, type: "Feature" })).toBe(false);
    expect(isBindableBug({ ...bug, trashedAt: new Date() })).toBe(false);
    expect(isBindableBug({ ...bug, archivedAt: new Date() })).toBe(false);
  });

  test("a GitHub PR is a live pull request, never an Issue", () => {
    expect(isBindablePullRequest(pull)).toBe(true);
    expect(isBindablePullRequest({ ...pull, kind: "Issue" })).toBe(false);
    expect(isBindablePullRequest({ ...pull, trashedAt: new Date() })).toBe(
      false,
    );
  });

  test("a bound record shows its own status read-only and hides archived content", () => {
    expect(bugTarget(bug)).toEqual({
      id: "work-1",
      label: "TK-7 Checkout 500s",
      status: "In Progress",
      type: "Bug",
      unavailable: false,
    });
    expect(pullRequestTarget(pull)).toMatchObject({
      label: "tidekit#42 Fix checkout",
      status: "merged",
      type: "GitHub PR",
    });
    expect(
      releaseTarget({ id: "r", name: "1.1", status: "Preparing" }),
    ).toMatchObject({ status: "Preparing", type: "Project Release" });
    expect(
      riskTarget({ id: "k", life: "Open", title: "Data loss" }),
    ).toMatchObject({ status: "Open", type: "Risk" });
    expect(
      decisionTarget({ id: "d", life: "Valid", title: "Use queue" }),
    ).toMatchObject({ status: "Valid", type: "Decision" });
    expect(bugTarget({ ...bug, trashedAt: new Date() })).toEqual({
      id: "work-1",
      label: null,
      status: null,
      type: "Bug",
      unavailable: true,
    });
    expect(missingTarget("Risk", "gone")).toMatchObject({
      label: null,
      unavailable: true,
    });
  });

  test("an identical repeated add derives the same link id; another target another id", async () => {
    const base = {
      incidentId: "incident-1",
      projectId: "project-1",
      targetId: "work-1",
      targetType: "Bug" as const,
    };
    const first = await productionIncidentLinkId(base);
    expect(await productionIncidentLinkId({ ...base })).toBe(first);
    expect(
      await productionIncidentLinkId({ ...base, targetId: "work-2" }),
    ).not.toBe(first);
    expect(
      await productionIncidentLinkId({ ...base, targetType: "Risk" }),
    ).not.toBe(first);
  });
});

describe("Production Incidents seam: follow-up Work preview", () => {
  const incident = {
    id: "incident-1",
    revision: 3,
    status: "Open" as const,
    title: "Checkout outage",
  };
  const choice = { title: "Add a canary", workType: "Task" as const };

  test("the preview names the one Work and the Origin relation, and leaves the status as it is", async () => {
    const { plan } = await previewOfFollowUp(
      buildFollowUpPlan(incident, choice),
    );
    expect(plan.work).toEqual({
      description: "Follow-up of Production Incident Checkout outage.",
      status: "Not Started",
      title: "Add a canary",
      type: "Task",
    });
    expect(plan.relations).toEqual([
      {
        from: {
          id: "incident-1",
          label: "Checkout outage",
          type: "Production Incident",
        },
        kind: "Origin",
        to: { label: "Add a canary", type: "Work" },
      },
    ]);
    expect(plan.incident.status).toBe("Open");
  });

  test("a Bug is previewed only when the founder chooses it", async () => {
    const { plan } = await previewOfFollowUp(
      buildFollowUpPlan(incident, { ...choice, workType: "Bug" }),
    );
    expect(plan.work.type).toBe("Bug");
    expect(buildFollowUpPlan(incident, choice).work.type).toBe("Task");
  });

  test("the fingerprint is stable and changes with the choice or the incident", async () => {
    const first = await previewOfFollowUp(buildFollowUpPlan(incident, choice));
    const again = await previewOfFollowUp(buildFollowUpPlan(incident, choice));
    expect(again.fingerprint).toBe(first.fingerprint);
    for (const changed of [
      buildFollowUpPlan(incident, { ...choice, title: "Other" }),
      buildFollowUpPlan(incident, { ...choice, workType: "Research" }),
      buildFollowUpPlan({ ...incident, revision: 4 }, choice),
      buildFollowUpPlan({ ...incident, status: "Resolved" }, choice),
      buildFollowUpPlan({ ...incident, title: "Renamed" }, choice),
    ]) {
      expect(changed).not.toEqual(first.plan);
    }
    const fingerprints = await Promise.all(
      [
        buildFollowUpPlan(incident, { ...choice, title: "Other" }),
        buildFollowUpPlan(incident, { ...choice, workType: "Research" }),
        buildFollowUpPlan({ ...incident, revision: 4 }, choice),
        buildFollowUpPlan({ ...incident, status: "Resolved" }, choice),
        buildFollowUpPlan({ ...incident, title: "Renamed" }, choice),
      ].map(async (plan) => (await previewOfFollowUp(plan)).fingerprint),
    );
    expect(new Set([first.fingerprint, ...fingerprints]).size).toBe(6);
  });
});

describe("Production Incidents seam: no alarm, Sentry or pager input", () => {
  test("the feature server code has no alarm, error-event or pager port", () => {
    for (const file of [
      ...sourceFiles(FEATURE_DIR),
      join(SERVER_SRC, "production-incidents-wiring.ts"),
    ]) {
      expect(
        readFileSync(file, "utf8").match(FORBIDDEN_PORT)?.[0] ?? null,
        relative(SERVER_SRC, file),
      ).toBeNull();
    }
  });

  test("only the Project source record adapter and this seam touch the incident tables", () => {
    const allowed = new Set([
      "features/production-incidents/server/production-incidents-database.ts",
      "features/project-source-records/server/project-source-records-database.ts",
    ]);
    const writers = sourceFiles(SERVER_SRC)
      .filter((file) => INCIDENT_TABLE_IMPORT.test(readFileSync(file, "utf8")))
      .map((file) => relative(SERVER_SRC, file))
      .filter((file) => !allowed.has(file));
    // Readers elsewhere (search, Daily Focus, reminders) never insert or update.
    for (const file of writers) {
      const text = readFileSync(join(SERVER_SRC, file), "utf8");
      expect(text, file).not.toMatch(INCIDENT_TABLE_WRITE);
    }
  });

  test("no server module that handles an operator alarm or an error event imports the incident tables", () => {
    for (const file of sourceFiles(SERVER_SRC)) {
      const text = readFileSync(file, "utf8");
      if (ALARM_OR_ERROR_EVENT.test(text)) {
        expect(text, relative(SERVER_SRC, file)).not.toMatch(
          INCIDENT_REFERENCE,
        );
      }
    }
  });

  test("the link table holds no timing, paging or score column", () => {
    const columns = Object.keys(productionIncidentLink).join(" ");
    expect(columns).not.toMatch(TIMING_COLUMN);
  });
});
