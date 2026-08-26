import {
	DESKTOP_API_CONTRACT,
	DESKTOP_API_HEADER,
	UPDATE_REQUIRED,
} from "@cantiara/api/desktop-api-window";
import { formatDateTime } from "@cantiara/auth/account-preferences-format";
import type { AccountPreferencesInput } from "@cantiara/auth/account-preferences-model";

export const CLIENT_SHELL_COPY = {
	lastSaved: "Last saved",
	unsavedChangesMayBeLost: "Unsaved changes may be lost",
	updateRequired: UPDATE_REQUIRED,
	youreOffline: "You’re offline",
} as const;

export type ClientShellHost = "web" | "tauri";

export type DesktopApiStatus = "unknown" | "accepted" | "update-required";

export type OnlineWorkKind =
	| "document-read"
	| "record-create"
	| "planning-change";

export interface ClientShell {
	connected: boolean;
	desktopApi: DesktopApiStatus;
	hasUnsavedChanges: boolean;
	host: ClientShellHost;
	lastSuccessfulSaveAt: Date | null;
	queuedWrites: readonly never[];
}

export type OnlineWorkResult<T> =
	| { kind: OnlineWorkKind; status: "applied"; value: T }
	| {
			kind: OnlineWorkKind;
			reason: "offline" | "update-required" | "pending";
			status: "refused";
	  };

export interface OfflineEmptyStateView {
	heading: typeof CLIENT_SHELL_COPY.youreOffline;
	lastSavedDisplay: string | null;
	lastSavedLabel: typeof CLIENT_SHELL_COPY.lastSaved;
	unsavedRisk: typeof CLIENT_SHELL_COPY.unsavedChangesMayBeLost | null;
}

export interface UpdateRequiredStateView {
	heading: typeof CLIENT_SHELL_COPY.updateRequired;
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
		desktopApi?: DesktopApiStatus;
		hasUnsavedChanges?: boolean;
		host?: ClientShellHost;
		lastSuccessfulSaveAt?: Date | null;
	} = {}
): ClientShell {
	const host = input.host ?? "web";
	return {
		connected: input.connected ?? true,
		desktopApi: input.desktopApi ?? (host === "tauri" ? "unknown" : "accepted"),
		hasUnsavedChanges: input.hasUnsavedChanges ?? false,
		host,
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

export function setClientShellDesktopApi(
	shell: ClientShell,
	desktopApi: DesktopApiStatus
): ClientShell {
	return { ...shell, desktopApi };
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
	if (shell.host === "tauri" && shell.desktopApi === "unknown") {
		return { kind, reason: "pending", status: "refused" };
	}
	if (shell.host === "tauri" && shell.desktopApi === "update-required") {
		return { kind, reason: "update-required", status: "refused" };
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

export function updateRequiredState(
	shell: ClientShell
): UpdateRequiredStateView | null {
	if (shell.host !== "tauri" || !shell.connected) {
		return null;
	}
	if (shell.desktopApi !== "update-required") {
		return null;
	}
	return { heading: CLIENT_SHELL_COPY.updateRequired };
}

export function readNavigatorOnline(
	runtime: { onLine?: boolean } = globalThis.navigator ?? {}
): boolean {
	return runtime.onLine !== false;
}

export function withDesktopApiHeaders(
	headers?: HeadersInit | Headers,
	host: ClientShellHost = detectClientShellHost()
): Headers {
	const next = new Headers(headers);
	if (host === "tauri" && !next.has(DESKTOP_API_HEADER)) {
		next.set(DESKTOP_API_HEADER, DESKTOP_API_CONTRACT);
	}
	return next;
}
