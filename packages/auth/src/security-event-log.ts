import { Pool } from "pg";

import type { SecurityEventLog, SessionAuditEvent } from "./session-events";
import { isSessionAuditEventType } from "./session-events";

export const LOCAL_SECURITY_EVENT_LOG_URL =
	"postgresql://cantiara:cantiara@127.0.0.1:5432/cantiara_security_events";

const DATABASE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const LEADING_SLASH = /^\//;

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
	let pool = createPool(connectionString);
	let ready: Promise<void> | undefined;

	async function db() {
		ready ??= ensureReady();
		try {
			await ready;
		} catch (error) {
			ready = undefined;
			throw error;
		}
		return pool;
	}

	async function ensureReady() {
		try {
			await pool.query(ENSURE_TABLE);
		} catch (error) {
			if (!isUndefinedDatabase(error)) {
				throw error;
			}
			await pool.end().catch(() => undefined);
			await ensureSecurityEventDatabase(connectionString);
			pool = createPool(connectionString);
			await pool.query(ENSURE_TABLE);
		}
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
		async close() {
			await pool.end();
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

async function ensureSecurityEventDatabase(
	connectionString: string
): Promise<void> {
	const database = databaseNameFromUrl(connectionString);
	const maintenance = new URL(connectionString);
	maintenance.pathname = "/postgres";
	const admin = new Pool({ connectionString: maintenance.toString() });
	try {
		await admin.query(`CREATE DATABASE ${database}`);
	} catch (error) {
		if (!isDuplicateDatabase(error)) {
			throw error;
		}
	} finally {
		await admin.end();
	}
}

function createPool(connectionString: string): Pool {
	const pool = new Pool({ connectionString });
	pool.on("error", () => undefined);
	return pool;
}

function databaseNameFromUrl(connectionString: string): string {
	const database = decodeURIComponent(
		new URL(connectionString).pathname.replace(LEADING_SLASH, "")
	);
	if (!DATABASE_NAME.test(database)) {
		throw new Error("Security-event log database name is invalid");
	}
	return database;
}

function toEvent(row: SecurityEventRow): SessionAuditEvent {
	if (!isSessionAuditEventType(row.type)) {
		throw new Error("Security-event log has an unknown event type");
	}
	return {
		accountAlias: row.account_alias,
		actorAlias: row.actor_alias,
		id: row.id,
		occurredAt: row.occurred_at.toISOString(),
		sessionAlias: row.session_alias,
		type: row.type,
	};
}

function postgresErrorCode(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return;
	}
	return typeof error.code === "string" ? error.code : undefined;
}

function isUndefinedDatabase(error: unknown): boolean {
	return postgresErrorCode(error) === "3D000";
}

function isDuplicateDatabase(error: unknown): boolean {
	return postgresErrorCode(error) === "42P04";
}
