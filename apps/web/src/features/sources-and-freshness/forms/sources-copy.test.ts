import { expect, test } from "vitest";

import { SOURCES_COPY } from "./sources-copy";

const FEED_COPY = /\bfeed\b/i;
const CREDENTIAL_COPY = /credential|access token|api key|session cookie/i;

test("English Source labels stay Source and Save as new Source version", () => {
	expect(SOURCES_COPY.source).toBe("Source");
	expect(SOURCES_COPY.createSource).toBe("Create Source");
	expect(SOURCES_COPY.saveAsNewSourceVersion).toBe(
		"Save as new Source version"
	);
	expect(SOURCES_COPY.address).toBe("Address");
	expect(SOURCES_COPY.accessedAt).toBe("Accessed at");
	expect(SOURCES_COPY.capturedContent).toBe("Captured content");
	expect(SOURCES_COPY.noSources).toBe("No Sources yet.");
	expect(JSON.stringify(SOURCES_COPY)).not.toMatch(FEED_COPY);
	expect(JSON.stringify(SOURCES_COPY)).not.toMatch(CREDENTIAL_COPY);
});
