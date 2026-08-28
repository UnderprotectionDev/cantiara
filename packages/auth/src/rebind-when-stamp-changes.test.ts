import { describe, expect, it } from "vitest";

import { rebindWhenStampChanges } from "./rebind-when-stamp-changes";

describe("rebindWhenStampChanges", () => {
	it("rebuilds the bound object when the stamp changes", () => {
		let stamp = "a";
		let created = 0;
		const bound = rebindWhenStampChanges(
			() => {
				created += 1;
				const generation = created;
				return {
					handler() {
						return generation;
					},
				};
			},
			() => stamp
		);
		expect(bound.handler()).toBe(1);
		expect(bound.handler()).toBe(1);
		stamp = "b";
		expect(bound.handler()).toBe(2);
	});
});
