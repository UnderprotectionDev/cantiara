import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";

import { createPostgresSecurityEventLog } from "./security-event-log";
import { SESSION_REVOKED_EVENT_TYPE } from "./session-events";

const ADMIN_URL = "postgresql://cantiara:cantiara@127.0.0.1:5432/postgres";

describe("Postgres security-event log", () => {
	const created: string[] = [];

	afterEach(async () => {
		const admin = new Pool({ connectionString: ADMIN_URL });
		try {
			await Promise.all(
				created
					.splice(0)
					.map((name) =>
						admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
					)
			);
		} finally {
			await admin.end();
		}
	});

	it("creates the security-event database when the catalog is missing", async () => {
		const name = `cantiara_sec_evt_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
		created.push(name);
		const databaseUrl = `postgresql://cantiara:cantiara@127.0.0.1:5432/${name}`;
		const log = createPostgresSecurityEventLog(databaseUrl);
		try {
			await log.append({
				accountAlias: "a".repeat(64),
				actorAlias: "b".repeat(64),
				id: crypto.randomUUID(),
				occurredAt: new Date().toISOString(),
				sessionAlias: "c".repeat(64),
				type: SESSION_REVOKED_EVENT_TYPE,
			});
			expect(await log.list()).toEqual([
				expect.objectContaining({ type: SESSION_REVOKED_EVENT_TYPE }),
			]);
		} finally {
			await log.close();
		}
	});
});
