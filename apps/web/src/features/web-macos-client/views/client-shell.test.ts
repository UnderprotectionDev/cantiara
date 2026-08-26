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
	CLIENT_SHELL_COPY,
	clientShellLocalTruth,
	clientShellWriteQueue,
	createClientShell,
	detectClientShellHost,
	markClientShellUnsaved,
	offlineEmptyState,
	recordClientShellSave,
	setClientShellConnection,
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
		const empty = offlineEmptyState(savedOfflineShell(), istanbul);

		expect(empty).toEqual({
			heading: "You’re offline",
			lastSavedDisplay: "29/03/2026, 15:00",
			lastSavedLabel: "Last saved",
			unsavedRisk: "Unsaved changes may be lost",
		});
		expect(empty?.heading).toBe(CLIENT_SHELL_COPY.youreOffline);
		expect(empty?.lastSavedLabel).toBe(CLIENT_SHELL_COPY.lastSaved);
		expect(empty?.unsavedRisk).toBe(CLIENT_SHELL_COPY.unsavedChangesMayBeLost);
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

		expect(attemptOnlineWork(web, "planning-change", write)).toEqual(
			attemptOnlineWork(tauri, "planning-change", write)
		);
		expect(offlineEmptyState(web, istanbul)).toEqual(
			offlineEmptyState(tauri, istanbul)
		);
		expect(clientShellLocalTruth(web)).toEqual(clientShellLocalTruth(tauri));
		expect(clientShellLocalTruth(tauri)).toEqual({
			deviceDatabase: false,
			projectFolder: null,
			queuedWrites: [],
		});
	});
});
