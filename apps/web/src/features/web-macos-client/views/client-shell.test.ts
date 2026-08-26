/**
 * Client Shell seam — Online-only çalışma: connection, last successful
 * save, unsaved-risk empty state, refused unqueued writes, and
 * reconnect that does not replay. Web and Tauri share this host.
 * Synthetic fixture for the online-only empty-state slice of
 * docs/prd/16-product-acceptance.md#platform-kabulu.
 */
import type { AccountPreferencesInput } from "@cantiara/auth/account-preferences-model";
import { describe, expect, it } from "vitest";

import {
	attemptOnlineWork,
	clientShellLocalTruth,
	clientShellWriteQueue,
	createClientShell,
	detectClientShellHost,
	markClientShellUnsaved,
	offlineEmptyState,
	recordClientShellSave,
	setClientShellConnection,
	updateRequiredState,
	withDesktopApiHeaders,
} from "./client-shell";

const SAVE_INSTANT = new Date("2026-03-29T12:00:00.000Z");

const istanbul: AccountPreferencesInput = {
	appearance: "Dark",
	dateFormat: "locale",
	firstDayOfWeek: "Monday",
	locale: "en-GB",
	timeZone: "Europe/Istanbul",
};

function savedOfflineShell(host: "web" | "tauri" = "web") {
	const online = recordClientShellSave(
		createClientShell({ connected: true, host }),
		SAVE_INSTANT
	);
	return setClientShellConnection(markClientShellUnsaved(online), false);
}

describe("Client Shell", () => {
	it("refuses document read, record create, and planning changes while offline and does not queue them", () => {
		const shell = createClientShell({ connected: false, host: "web" });
		const work = (): string => "written";

		expect(attemptOnlineWork(shell, "document-read", work)).toEqual({
			kind: "document-read",
			reason: "offline",
			status: "refused",
		});
		expect(attemptOnlineWork(shell, "record-create", work)).toEqual({
			kind: "record-create",
			reason: "offline",
			status: "refused",
		});
		expect(attemptOnlineWork(shell, "planning-change", work)).toEqual({
			kind: "planning-change",
			reason: "offline",
			status: "refused",
		});
		expect(clientShellWriteQueue(shell)).toEqual([]);
		expect(clientShellLocalTruth(shell)).toEqual({
			deviceDatabase: false,
			projectFolder: null,
			queuedWrites: [],
		});
	});

	it("applies online work immediately and never leaves a queue row", () => {
		const shell = createClientShell({ connected: true, host: "web" });
		let applied = 0;

		expect(
			attemptOnlineWork(shell, "record-create", () => {
				applied += 1;
				return "created";
			})
		).toEqual({
			kind: "record-create",
			status: "applied",
			value: "created",
		});
		expect(applied).toBe(1);
		expect(clientShellWriteQueue(shell)).toEqual([]);
	});

	it("shows You’re offline, Last saved, and Unsaved changes may be lost with Hesap locale time", () => {
		expect(offlineEmptyState(savedOfflineShell(), istanbul)).toEqual({
			heading: "You’re offline",
			lastSavedDisplay: "29/03/2026, 15:00",
			lastSavedLabel: "Last saved",
			unsavedRisk: "Unsaved changes may be lost",
		});
	});

	it("omits Unsaved changes may be lost when the last successful save left nothing unsaved", () => {
		const clean = setClientShellConnection(
			recordClientShellSave(
				createClientShell({ connected: true, host: "web" }),
				SAVE_INSTANT
			),
			false
		);

		expect(offlineEmptyState(clean, istanbul)).toEqual({
			heading: "You’re offline",
			lastSavedDisplay: "29/03/2026, 15:00",
			lastSavedLabel: "Last saved",
			unsavedRisk: null,
		});
	});

	it("formats Last saved with the Hesap locale and time zone, not a Client Shell schema", () => {
		const empty = offlineEmptyState(savedOfflineShell(), {
			...istanbul,
			locale: "en-US",
			timeZone: "America/New_York",
		});

		expect(empty?.lastSavedDisplay).toBe("03/29/2026, 08:00 AM");
	});

	it("hides the founder empty state while connected", () => {
		expect(
			offlineEmptyState(
				createClientShell({ connected: true, host: "web" }),
				istanbul
			)
		).toBeNull();
	});

	it("does not replay a refused write when the shell reconnects; the founder saves again", () => {
		const offline = createClientShell({ connected: false, host: "web" });
		let applied = 0;
		const write = () => {
			applied += 1;
			return "created";
		};

		expect(attemptOnlineWork(offline, "record-create", write).status).toBe(
			"refused"
		);
		const reconnected = setClientShellConnection(offline, true);
		expect(applied).toBe(0);
		expect(clientShellWriteQueue(reconnected)).toEqual([]);

		expect(attemptOnlineWork(reconnected, "record-create", write)).toEqual({
			kind: "record-create",
			status: "applied",
			value: "created",
		});
		expect(applied).toBe(1);
	});

	it("uses the same online-only rule on web and Tauri without a device database or project folder", () => {
		expect(detectClientShellHost({})).toBe("web");
		expect(detectClientShellHost({ __TAURI_INTERNALS__: {} })).toBe("tauri");
		const web = savedOfflineShell("web");
		const tauri = savedOfflineShell("tauri");
		const write = () => "created";
		const refused = {
			kind: "planning-change" as const,
			reason: "offline" as const,
			status: "refused" as const,
		};
		const empty = {
			heading: "You’re offline",
			lastSavedDisplay: "29/03/2026, 15:00",
			lastSavedLabel: "Last saved",
			unsavedRisk: "Unsaved changes may be lost",
		};
		const localTruth = {
			deviceDatabase: false,
			projectFolder: null,
			queuedWrites: [],
		};

		expect(attemptOnlineWork(web, "planning-change", write)).toEqual(refused);
		expect(attemptOnlineWork(tauri, "planning-change", write)).toEqual(refused);
		expect(offlineEmptyState(web, istanbul)).toEqual(empty);
		expect(offlineEmptyState(tauri, istanbul)).toEqual(empty);
		expect(clientShellLocalTruth(web)).toEqual(localTruth);
		expect(clientShellLocalTruth(tauri)).toEqual(localTruth);
	});

	it("accepts writes from the current or previous signed desktop API inside the 30-day window", () => {
		const shell = createClientShell({
			connected: true,
			desktopApi: "accepted",
			host: "tauri",
		});
		expect(attemptOnlineWork(shell, "record-create", () => "created")).toEqual({
			kind: "record-create",
			status: "applied",
			value: "created",
		});
		expect(updateRequiredState(shell)).toBeNull();
	});

	it("stops an expired desktop with Update required before a write and does not queue it", () => {
		const shell = createClientShell({
			connected: true,
			desktopApi: "update-required",
			host: "tauri",
		});
		const work = (): string => "written";
		const refused = {
			kind: "record-create" as const,
			reason: "update-required" as const,
			status: "refused" as const,
		};

		expect(attemptOnlineWork(shell, "record-create", work)).toEqual(refused);
		expect(attemptOnlineWork(shell, "planning-change", work)).toEqual({
			...refused,
			kind: "planning-change",
		});
		expect(clientShellWriteQueue(shell)).toEqual([]);
		expect(updateRequiredState(shell)).toEqual({
			heading: "Update required",
		});
	});

	it("sends the signed desktop API contract only from the Tauri shell", () => {
		expect(
			withDesktopApiHeaders(undefined, "web").has("Cantiara-Desktop-Api")
		).toBe(false);
		expect(
			withDesktopApiHeaders(undefined, "tauri").get("Cantiara-Desktop-Api")
		).toBe("1");
	});

	it("refuses Tauri writes until the desktop API window is known, without Update required", () => {
		const shell = createClientShell({ connected: true, host: "tauri" });
		expect(attemptOnlineWork(shell, "record-create", () => "created")).toEqual({
			kind: "record-create",
			reason: "pending",
			status: "refused",
		});
		expect(updateRequiredState(shell)).toBeNull();
	});

	it("does not show Update required on web or while the founder is offline", () => {
		expect(
			updateRequiredState(
				createClientShell({
					connected: true,
					desktopApi: "update-required",
					host: "web",
				})
			)
		).toBeNull();
		expect(
			updateRequiredState(
				createClientShell({
					connected: false,
					desktopApi: "update-required",
					host: "tauri",
				})
			)
		).toBeNull();
	});
});
