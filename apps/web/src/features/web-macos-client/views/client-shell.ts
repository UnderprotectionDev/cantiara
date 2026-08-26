import { formatDateTime } from "@cantiara/auth/account-preferences-format";
import type { AccountPreferencesInput } from "@cantiara/auth/account-preferences-model";

export const CLIENT_SHELL_COPY = {
	lastSaved: "Last saved",
	unsavedChangesMayBeLost: "Unsaved changes may be lost",
	youreOffline: "You’re offline",
} as const;

export type ClientShellHost = "web" | "tauri";

export type OnlineWorkKind =
	| "document-read"
	| "record-create"
	| "planning-change";

export interface ClientShell {
	connected: boolean;
	hasUnsavedChanges: boolean;
	host: ClientShellHost;
	lastSuccessfulSaveAt: Date | null;
	queuedWrites: readonly never[];
}

export type OnlineWorkResult<T> =
	| { kind: OnlineWorkKind; status: "applied"; value: T }
	| { kind: OnlineWorkKind; reason: "offline"; status: "refused" };

export interface OfflineEmptyStateView {
	heading: typeof CLIENT_SHELL_COPY.youreOffline;
	lastSavedDisplay: string | null;
	lastSavedLabel: typeof CLIENT_SHELL_COPY.lastSaved;
	unsavedRisk: typeof CLIENT_SHELL_COPY.unsavedChangesMayBeLost | null;
}

export interface ClientShellLocalTruth {
	deviceDatabase: false;
	projectFolder: null;
	queuedWrites: readonly never[];
}

export function detectClientShellHost(
	runtime: object = globalThis
): ClientShellHost {
	return "__TAURI_INTERNALS__" in runtime ? "tauri" : "web";
}

export function createClientShell(
	input: {
		connected?: boolean;
		hasUnsavedChanges?: boolean;
		host?: ClientShellHost;
		lastSuccessfulSaveAt?: Date | null;
	} = {}
): ClientShell {
	return {
		connected: input.connected ?? true,
		hasUnsavedChanges: input.hasUnsavedChanges ?? false,
		host: input.host ?? "web",
		lastSuccessfulSaveAt: input.lastSuccessfulSaveAt ?? null,
		queuedWrites: [],
	};
}

export function setClientShellConnection(
	shell: ClientShell,
	connected: boolean
): ClientShell {
	return { ...shell, connected };
}

export function markClientShellUnsaved(shell: ClientShell): ClientShell {
	return { ...shell, hasUnsavedChanges: true };
}

export function recordClientShellSave(
	shell: ClientShell,
	instant: Date
): ClientShell {
	return {
		...shell,
		hasUnsavedChanges: false,
		lastSuccessfulSaveAt: instant,
	};
}

export function attemptOnlineWork<T>(
	shell: ClientShell,
	kind: OnlineWorkKind,
	work: () => T
): OnlineWorkResult<T> {
	if (!shell.connected) {
		return { kind, reason: "offline", status: "refused" };
	}
	return { kind, status: "applied", value: work() };
}

export function clientShellWriteQueue(shell: ClientShell): readonly never[] {
	return shell.queuedWrites;
}

export function clientShellLocalTruth(
	shell: ClientShell
): ClientShellLocalTruth {
	return {
		deviceDatabase: false,
		projectFolder: null,
		queuedWrites: shell.queuedWrites,
	};
}

export function offlineEmptyState(
	shell: ClientShell,
	preferences: AccountPreferencesInput
): OfflineEmptyStateView | null {
	if (shell.connected) {
		return null;
	}
	return {
		heading: CLIENT_SHELL_COPY.youreOffline,
		lastSavedDisplay: shell.lastSuccessfulSaveAt
			? formatDateTime(shell.lastSuccessfulSaveAt, preferences)
			: null,
		lastSavedLabel: CLIENT_SHELL_COPY.lastSaved,
		unsavedRisk: shell.hasUnsavedChanges
			? CLIENT_SHELL_COPY.unsavedChangesMayBeLost
			: null,
	};
}

export function readNavigatorOnline(
	runtime: { onLine?: boolean } = globalThis.navigator ?? {}
): boolean {
	return runtime.onLine !== false;
}
