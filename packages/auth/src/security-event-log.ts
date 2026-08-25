import { Pool } from "pg";

import type { SecurityEventLog, SessionRevokedEvent } from "./session-events";
import { SESSION_REVOKED_EVENT_TYPE } from "./session-events";

export const LOCAL_SECURITY_EVENT_LOG_URL =
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara_security_events";

const ENSURE_TABLE = `
CREATE TABLE IF NOT EXISTS security_event (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  account_alias TEXT NOT NULL,
  session_alias TEXT NOT NULL,
  actor_alias TEXT NOT NULL
)
`;

const ENSURE_INDEX = `
CREATE INDEX IF NOT EXISTS security_event_session_alias_idx
  ON security_event (type, session_alias)
`;

interface SecurityEventRow {
	account_alias: string;
	actor_alias: string;
	id: string;
	occurred_at: Date;
	session_alias: string;
	type: string;
}

export function createPostgresSecurityEventLog(
	connectionString: string
): SecurityEventLog {
	const pool = new Pool({ connectionString });
	let ready: Promise<void> | undefined;

	async function db() {
		ready ??= pool
			.query(ENSURE_TABLE)
			.then(() => pool.query(ENSURE_INDEX))
			.then(() => undefined);
		await ready;
		return pool;
	}

	return {
		async append(event) {
			const client = await db();
			await client.query(
				`INSERT INTO security_event (
          id, type, occurred_at, account_alias, session_alias, actor_alias
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
				[
					event.id,
					event.type,
					event.occurredAt,
					event.accountAlias,
					event.sessionAlias,
					event.actorAlias,
				]
			);
		},
		async isRevoked(sessionAlias) {
			const client = await db();
			const result = await client.query(
				`SELECT 1 FROM security_event
         WHERE type = $1 AND session_alias = $2
         LIMIT 1`,
				[SESSION_REVOKED_EVENT_TYPE, sessionAlias]
			);
			return (result.rowCount ?? 0) > 0;
		},
		async list() {
			const client = await db();
			const result = await client.query<SecurityEventRow>(
				`SELECT id, type, occurred_at, account_alias, session_alias, actor_alias
         FROM security_event
         ORDER BY occurred_at ASC, id ASC`
			);
			return result.rows.map(toEvent);
		},
		async replay(apply) {
			const events = await this.list();
			await events.reduce(
				(done, event) => done.then(() => apply(event)),
				Promise.resolve()
			);
		},
	};
}

function toEvent(row: SecurityEventRow): SessionRevokedEvent {
	return {
		accountAlias: row.account_alias,
		actorAlias: row.actor_alias,
		id: row.id,
		occurredAt: row.occurred_at.toISOString(),
		sessionAlias: row.session_alias,
		type: SESSION_REVOKED_EVENT_TYPE,
	};
}
