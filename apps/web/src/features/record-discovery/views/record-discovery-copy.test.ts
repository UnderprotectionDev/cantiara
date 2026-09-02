import { expect, test } from "vitest";

import { RECORD_DISCOVERY_COPY } from "./record-discovery-copy";

const PALETTE = /Command Palette/;
const FORBIDDEN_RANKING = /click history|semantic|AI rank/i;

test("English Search copy is Search, not Command Palette", () => {
	expect(RECORD_DISCOVERY_COPY.search).toBe("Search");
	expect(RECORD_DISCOVERY_COPY.query).toBe("Query");
	expect(RECORD_DISCOVERY_COPY.includeArchived).toBe("Include archived");
	expect(RECORD_DISCOVERY_COPY.work).toBe("Work");
	expect(RECORD_DISCOVERY_COPY.document).toBe("Document");
	expect(RECORD_DISCOVERY_COPY.fileAttachment).toBe("File Attachment");
	expect(RECORD_DISCOVERY_COPY.allWork).toBe("All Work");
	expect(RECORD_DISCOVERY_COPY.allDocuments).toBe("All Documents");
	expect(RECORD_DISCOVERY_COPY.allFiles).toBe("All Files");
	expect(RECORD_DISCOVERY_COPY.openSourceRecord).toBe("Open source record");
	expect(RECORD_DISCOVERY_COPY.technicalDiagram).toBe("Technical Diagram");
	expect(RECORD_DISCOVERY_COPY.captureInboxItem).toBe("Capture Inbox item");
	expect(RECORD_DISCOVERY_COPY.draft).toBe("Draft");
	expect(RECORD_DISCOVERY_COPY.externalSurface).toBe("External Surface");
	expect(RECORD_DISCOVERY_COPY.githubExternalRecord).toBe(
		"GitHub external record"
	);
	expect(JSON.stringify(RECORD_DISCOVERY_COPY)).not.toMatch(PALETTE);
	expect(JSON.stringify(RECORD_DISCOVERY_COPY)).not.toMatch(FORBIDDEN_RANKING);
});
