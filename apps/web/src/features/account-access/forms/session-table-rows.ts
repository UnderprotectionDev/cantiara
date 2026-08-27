export interface SessionTableRow {
	current: boolean;
	device: string;
	id: string;
	lastActivity: string;
}

function isSessionTableRow(value: unknown): value is SessionTableRow {
	if (!value || typeof value !== "object") {
		return false;
	}
	const row = value as Partial<SessionTableRow>;
	return (
		typeof row.id === "string" &&
		typeof row.device === "string" &&
		typeof row.lastActivity === "string" &&
		typeof row.current === "boolean"
	);
}

export function sessionTableRows(data: unknown): SessionTableRow[] {
	if (!Array.isArray(data)) {
		return [];
	}
	return data.filter(isSessionTableRow);
}
