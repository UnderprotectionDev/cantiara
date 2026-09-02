import { expect, test } from "vitest";

import { PERSONAL_WIKI_COPY } from "./personal-wiki-copy";

const FORBIDDEN_COPY = /Publish|Unpublish|Invite|Co-edit|page role/i;

test("English Personal Wiki label is Personal Wiki", () => {
	expect(PERSONAL_WIKI_COPY.personalWiki).toBe("Personal Wiki");
	expect(JSON.stringify(PERSONAL_WIKI_COPY)).not.toMatch(FORBIDDEN_COPY);
});
