import { expect, test } from "vitest";

import {
	RELATIONS_COPY,
	USAGE_KIND_LABEL,
	USAGE_KINDS,
} from "./relations-copy";

test("usage kind labels stay off the Related catalog", () => {
	expect([...USAGE_KINDS]).toEqual([
		"inline-record-reference",
		"stable-section-reference",
		"live-content-block",
		"pinned-file-or-wireframe-bind",
		"flow-node-screen-reference",
	]);
	expect(Object.values(USAGE_KIND_LABEL)).toEqual([
		"Screen reference",
		"Inline reference",
		"Live block",
		"Pinned bind",
		"Section reference",
	]);
	expect(Object.values(USAGE_KIND_LABEL)).not.toContain(RELATIONS_COPY.related);
	expect(RELATIONS_COPY.unlink).toBe("Unlink");
});
