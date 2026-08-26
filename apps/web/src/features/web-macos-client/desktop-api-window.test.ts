/**
 * Client Shell seam — 30-day signed desktop API window.
 * Current and previous signed desktop API contracts are accepted for 30
 * days after the current desktop ships. A client outside that window is
 * stopped with Update required before an unsafe write.
 * docs/specs/03-web-macos-client/spec.md and
 * docs/prd/16-product-acceptance.md#platform-kabulu
 */

import {
	assertDesktopApiWriteAllowed,
	DESKTOP_API_WINDOW_DAYS,
	evaluateDesktopApiWindow,
	type SignedDesktopApiCatalog,
	UPDATE_REQUIRED,
} from "@cantiara/api/desktop-api-window";
import { expect, test } from "vitest";

const SHIPPED = new Date("2026-08-01T00:00:00.000Z");
const DAY_30 = new Date("2026-08-31T00:00:00.000Z");
const DAY_31 = new Date("2026-09-01T00:00:00.000Z");

const catalog: SignedDesktopApiCatalog = {
	current: { contract: "2", shippedAt: SHIPPED },
	previous: { contract: "1" },
};

test("the desktop API window is 30 days", () => {
	expect(DESKTOP_API_WINDOW_DAYS).toBe(30);
	expect(UPDATE_REQUIRED).toBe("Update required");
});

test("current and previous signed desktop APIs accept writes on the 30th day", () => {
	expect(evaluateDesktopApiWindow("2", catalog, DAY_30)).toEqual({
		status: "accepted",
	});
	expect(evaluateDesktopApiWindow("1", catalog, DAY_30)).toEqual({
		status: "accepted",
	});
	expect(() =>
		assertDesktopApiWriteAllowed("1", catalog, DAY_30)
	).not.toThrow();
});

test("current signed desktop API still accepts writes after day 30", () => {
	expect(evaluateDesktopApiWindow("2", catalog, DAY_31)).toEqual({
		status: "accepted",
	});
	expect(() =>
		assertDesktopApiWriteAllowed("2", catalog, DAY_31)
	).not.toThrow();
});

test("previous signed desktop API requires Update required before a write after day 30", () => {
	expect(evaluateDesktopApiWindow("1", catalog, DAY_31)).toEqual({
		status: "update-required",
	});
	expect(() => assertDesktopApiWriteAllowed("1", catalog, DAY_31)).toThrow(
		UPDATE_REQUIRED
	);
});

test("a desktop older than previous is stopped even inside 30 days", () => {
	expect(evaluateDesktopApiWindow("0", catalog, DAY_30)).toEqual({
		status: "update-required",
	});
});

test("a web client without a desktop API header is accepted", () => {
	expect(evaluateDesktopApiWindow(null, catalog, DAY_31)).toEqual({
		status: "accepted",
	});
	expect(evaluateDesktopApiWindow("", catalog, DAY_31)).toEqual({
		status: "accepted",
	});
});

test("the first signed desktop has no previous contract to keep alive", () => {
	const first: SignedDesktopApiCatalog = {
		current: { contract: "1", shippedAt: SHIPPED },
		previous: null,
	};
	expect(evaluateDesktopApiWindow("1", first, DAY_31)).toEqual({
		status: "accepted",
	});
	expect(evaluateDesktopApiWindow("0", first, DAY_30)).toEqual({
		status: "update-required",
	});
});
