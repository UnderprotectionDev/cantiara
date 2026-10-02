import { createSecurityEventDb } from "@cantiara/db/security-events";
import { afterAll, describe, expect, it } from "vitest";
import { createDatabaseDocumentSurfaceCancellations } from "./document-surface-cancellations";

const databaseUrl = process.env.SECURITY_EVENT_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Document surface cancellation security journal", () => {
  const database = databaseUrl
    ? createSecurityEventDb({ DATABASE_URL: databaseUrl })
    : undefined;

  afterAll(async () => {
    await database?.$client.end();
  });

  it("persists one content-free cancellation across independent journal readers", async () => {
    if (!database) {
      throw new Error("SECURITY_EVENT_DATABASE_URL is required");
    }
    const event = {
      actorAlias: `test-actor-${crypto.randomUUID()}`,
      surfaceId: `test-surface-${crypto.randomUUID()}`,
      occurredAt: new Date("2026-10-02T08:00:00.000Z"),
    };
    const journal = createDatabaseDocumentSurfaceCancellations(database);
    await journal.append(event);
    await journal.append({
      ...event,
      occurredAt: new Date("2026-10-02T09:00:00.000Z"),
    });
    const restored = createDatabaseDocumentSurfaceCancellations(database);
    const cancellations = (await restored.list()).filter(
      (record) => record.surfaceId === event.surfaceId,
    );
    expect(cancellations).toEqual([event]);
  });
});
