export const SESSION_REVOKED_EVENT_TYPE = "session.revoked" as const;

export interface SessionRevokedEvent {
	accountAlias: string;
	actorAlias: string;
	id: string;
	occurredAt: string;
	sessionAlias: string;
	type: typeof SESSION_REVOKED_EVENT_TYPE;
}

export interface AuditLog {
	append: (event: SessionRevokedEvent) => Promise<void>;
	list: () => Promise<readonly SessionRevokedEvent[]>;
}

export interface SecurityEventLog {
	append: (event: SessionRevokedEvent) => Promise<void>;
	isRevoked: (sessionAlias: string) => Promise<boolean>;
	list: () => Promise<readonly SessionRevokedEvent[]>;
	replay: (
		apply: (event: SessionRevokedEvent) => Promise<void>
	) => Promise<void>;
}

export function createMemoryAuditLog(): AuditLog {
	const events: SessionRevokedEvent[] = [];
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
	const events: SessionRevokedEvent[] = [];
	return {
		append(event) {
			events.push(event);
			return Promise.resolve();
		},
		isRevoked(sessionAlias) {
			return Promise.resolve(
				events.some(
					(event) =>
						event.type === SESSION_REVOKED_EVENT_TYPE &&
						event.sessionAlias === sessionAlias
				)
			);
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
