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
	expect(SOURCES_COPY.saveAsSource).toBe("Save as Source");
	expect(SOURCES_COPY.liveExternalSource).toBe("Live external source");
	expect(SOURCES_COPY.livePreview).toBe("Live preview");
	expect(SOURCES_COPY.historicalSnapshot).toBe("Historical snapshot");
	expect(SOURCES_COPY.recheckSource).toBe("Recheck source");
	expect(SOURCES_COPY.keepCurrentVersion).toBe("Keep current version");
	expect(SOURCES_COPY.newerSourceVersionExists).toBe(
		"Newer Source version exists"
	);
	expect(SOURCES_COPY.reviewedKeepCurrentVersion).toBe(
		"Reviewed; keep current version"
	);
	expect(SOURCES_COPY.rebindToNewVersion).toBe("Rebind to new version");
	expect(SOURCES_COPY.noMatchInCandidateVersion).toBe(
		"No match in candidate version"
	);
	expect(JSON.stringify(SOURCES_COPY)).not.toMatch(FEED_COPY);
	expect(JSON.stringify(SOURCES_COPY)).not.toMatch(CREDENTIAL_COPY);
});
