import { createSecurityEventDb } from "@cantiara/db/security-events";
import { afterAll, describe, expect, test } from "vitest";

import {
  createDatabasePriorityMetricPermanentDeleteEvents,
  PRIORITY_METRIC_PERMANENT_DELETE_EVENT_TYPE,
  type PriorityMetricPermanentDeleteEvent,
} from "./priority-metrics-trash-database";

const databaseUrl = process.env.SECURITY_EVENT_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Priority metric protected delete log", () => {
  const database = databaseUrl
    ? createSecurityEventDb({ DATABASE_URL: databaseUrl })
    : undefined;

  afterAll(async () => {
    await database?.$client.end();
  });

  test("appends the content-free event idempotently", async () => {
    if (!database) {
      throw new Error("SECURITY_EVENT_DATABASE_URL is required");
    }

    const events = createDatabasePriorityMetricPermanentDeleteEvents(database);
    const event: PriorityMetricPermanentDeleteEvent = {
      actorAlias: `test-actor-${crypto.randomUUID()}`,
      occurredAt: new Date().toISOString(),
      id: `priority-metric-test-${crypto.randomUUID()}`,
      targetAlias: `test-target-${crypto.randomUUID()}`,
      type: PRIORITY_METRIC_PERMANENT_DELETE_EVENT_TYPE,
      version: 1 as const,
    };

    await events.append(event);
    await events.append(event);

    await expect(events.list()).resolves.toContainEqual(event);
  });
});
