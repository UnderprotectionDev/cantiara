import { identityAlias } from "./identity-alias";

export const SESSION_SIGNED_IN_EVENT_TYPE = "session.signed_in" as const;
export const SESSION_SIGNED_OUT_EVENT_TYPE = "session.signed_out" as const;
export const SESSION_REVOKED_EVENT_TYPE = "session.revoked" as const;

export type SessionAuditEventType =
	| typeof SESSION_SIGNED_IN_EVENT_TYPE
	| typeof SESSION_SIGNED_OUT_EVENT_TYPE
	| typeof SESSION_REVOKED_EVENT_TYPE;

export interface SessionAuditEvent {
	accountAlias: string;
	actorAlias: string;
	id: string;
	occurredAt: string;
	sessionAlias: string;
	type: SessionAuditEventType;
}

export type SessionRevokedEvent = SessionAuditEvent & {
	type: typeof SESSION_REVOKED_EVENT_TYPE;
};

export interface AuditLog {
	append: (event: SessionAuditEvent) => Promise<void>;
	list: () => Promise<readonly SessionAuditEvent[]>;
}

export interface SecurityEventLog {
	append: (event: SessionAuditEvent) => Promise<void>;
	close: () => Promise<void>;
	list: () => Promise<readonly SessionAuditEvent[]>;
	replay: (apply: (event: SessionAuditEvent) => Promise<void>) => Promise<void>;
}

export function isSessionAuditEventType(
	value: string
): value is SessionAuditEventType {
	return (
		value === SESSION_SIGNED_IN_EVENT_TYPE ||
		value === SESSION_SIGNED_OUT_EVENT_TYPE ||
		value === SESSION_REVOKED_EVENT_TYPE
	);
}

export function sessionAuditEvent(input: {
	accountId: string;
	actorId: string;
	now: Date;
	secret: string;
	sessionId: string;
	type: SessionAuditEventType;
}): SessionAuditEvent {
	return {
		accountAlias: identityAlias("account", input.accountId, input.secret),
		actorAlias: identityAlias("account", input.actorId, input.secret),
		id: crypto.randomUUID(),
		occurredAt: input.now.toISOString(),
		sessionAlias: identityAlias("session", input.sessionId, input.secret),
		type: input.type,
	};
}

export function createMemoryAuditLog(): AuditLog {
	const events: SessionAuditEvent[] = [];
	return {
		append(event) {
			events.push(event);
			return Promise.resolve();
		},
		list() {
			return Promise.resolve([...events]);
		},
	};
}

export function createMemorySecurityEventLog(): SecurityEventLog {
	const events: SessionAuditEvent[] = [];
	return {
		append(event) {
			events.push(event);
			return Promise.resolve();
		},
		close() {
			return Promise.resolve();
		},
		list() {
			return Promise.resolve([...events]);
		},
		async replay(apply) {
			await events.reduce(
				(done, event) => done.then(() => apply(event)),
				Promise.resolve()
			);
		},
	};
}
