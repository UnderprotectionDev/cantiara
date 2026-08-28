import { expect, test } from "vitest";

import { GENERIC_RELATION_TYPES, RELATIONS_COPY } from "./relations-copy";

test("English relation labels match the closed catalog", () => {
	expect(RELATIONS_COPY.related).toBe("Related");
	expect(RELATIONS_COPY.origin).toBe("Origin");
	expect(RELATIONS_COPY.derived).toBe("Derived");
	expect(RELATIONS_COPY.archived).toBe("Archived");
	expect(RELATIONS_COPY.inTrash).toBe("In Trash");
	expect(RELATIONS_COPY.permanentlyDeleted).toBe("Permanently deleted");
	expect(RELATIONS_COPY.redactedForSecurity).toBe("Redacted for security");
	expect(RELATIONS_COPY.noAccess).toBe("No access");
	expect(RELATIONS_COPY.openSourceRecord).toBe("Open source record");
	expect(RELATIONS_COPY.usedIn).toBe("Used in");
	expect(GENERIC_RELATION_TYPES).toEqual(["Related", "Origin"]);
});
