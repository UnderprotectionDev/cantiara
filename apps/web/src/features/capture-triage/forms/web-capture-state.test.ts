import { expect, test } from "vitest";

import {
	clipperBrowserFromUserAgent,
	clipperFamilyFromUserAgent,
	extensionLinkSearchInput,
	pairingCodeDisplay,
} from "./web-capture-state";

test("pairing code display is the issued code", () => {
	expect(pairingCodeDisplay("AB23KLPQ")).toBe("AB23KLPQ");
});

test("Inbox search is not limited to recently opened Projects", () => {
	expect(extensionLinkSearchInput("Archive Tool")).toEqual({
		query: "Archive Tool",
	});
	expect(extensionLinkSearchInput("  ")).toEqual({});
});

test("clipper family maps Chromium and Firefox and does not treat Safari as supported", () => {
	expect(
		clipperFamilyFromUserAgent("Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36")
	).toBe("chromium");
	expect(clipperFamilyFromUserAgent("Mozilla/5.0 Firefox/128.0")).toBe(
		"firefox"
	);
	expect(
		clipperFamilyFromUserAgent(
			"Mozilla/5.0 Macintosh Intel Mac OS X 14_0 Safari/605.1.15"
		)
	).toBe("safari");
	expect(clipperBrowserFromUserAgent("Mozilla/5.0 Edg/120.0")).toBe("Edge");
	expect(clipperBrowserFromUserAgent("Mozilla/5.0 Firefox/128.0")).toBe(
		"Firefox"
	);
});
