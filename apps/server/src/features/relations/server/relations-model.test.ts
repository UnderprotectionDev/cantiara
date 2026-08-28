/**
 * Relations seam — usage kinds are a closed list, usage is not
 * Related, and inspect keeps usage out of relation counts.
 * Synthetic fixture for
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Arama ve ilişki usage package).
 */
import { describe, expect, it } from "vitest";

import {
	inspectRecordGraph,
	presentUsedIn,
	RELATIONS_COPY,
	toUsageLinkView,
	USAGE_KIND,
	USAGE_KINDS,
} from "./relations-model";

const RELATED_JSON = /"Related"/;
const USAGE_METADATA = /evidenceRole|cardinality/;

describe("Relations usage catalog", () => {
	it("ships the closed usage kinds and never labels them Related", () => {
		expect([...USAGE_KINDS]).toEqual([
			USAGE_KIND.inlineRecordReference,
			USAGE_KIND.stableSectionReference,
			USAGE_KIND.liveContentBlock,
			USAGE_KIND.pinnedFileOrWireframeBind,
			USAGE_KIND.flowNodeScreenReference,
		]);
		const view = toUsageLinkView({
			embedId: "embed-intake",
			hostRecordId: "host-doc",
			id: "usage-1",
			kind: USAGE_KIND.inlineRecordReference,
			sourceRecordId: "source-work",
		});
		expect(view.kindLabel).toBe("Inline reference");
		expect(view.kindLabel).not.toBe(RELATIONS_COPY.related);
		expect(JSON.stringify(view)).not.toMatch(RELATED_JSON);
		expect(JSON.stringify(view)).not.toMatch(USAGE_METADATA);
	});

	it("counts only typed relations on inspect", () => {
		const graph = inspectRecordGraph({
			typedRelations: [{ id: "rel-1", type: RELATIONS_COPY.related }],
			usageLinks: [
				toUsageLinkView({
					embedId: "embed-flow",
					hostRecordId: "flow-1",
					id: "usage-2",
					kind: USAGE_KIND.flowNodeScreenReference,
					sourceRecordId: "screen-1",
				}),
			],
		});
		expect(graph.relationCount).toBe(1);
		expect(graph.typedRelations).toEqual([{ id: "rel-1", type: "Related" }]);
		expect(graph.usageLinks).toHaveLength(1);
		expect(graph.usageLinks[0]?.kindLabel).toBe("Screen reference");
		expect(graph.copy.unlink).toBe("Unlink");
	});
});

describe("Relations Used in", () => {
	it("keeps relation backlinks and usage in separate groups and out of each other's counts", () => {
		const usedIn = presentUsedIn({
			relationBacklinks: [
				{
					groupLabel: RELATIONS_COPY.related,
					id: "rel-1",
					key: "PAY-1",
					openSourceRecord: true,
					sourceRecordId: "wallet",
					title: "Wallet",
				},
			],
			usageRows: [
				{
					groupLabel: "Inline reference",
					id: "usage-1",
					key: "PAY-2",
					openSourceRecord: true,
					sourceRecordId: "spec-host",
					title: "Checkout spec",
				},
				{
					groupLabel: "Screen reference",
					id: "usage-2",
					openSourceRecord: true,
					sourceRecordId: "flow-node-pay",
				},
			],
		});
		expect(usedIn.copy.usedIn).toBe("Used in");
		expect(usedIn.copy.openSourceRecord).toBe("Open source record");
		expect(usedIn.relationCount).toBe(1);
		expect(usedIn.relationBacklinks).toEqual([
			{
				label: "Related",
				rows: [
					{
						groupLabel: "Related",
						id: "rel-1",
						key: "PAY-1",
						openSourceRecord: true,
						sourceRecordId: "wallet",
						title: "Wallet",
					},
				],
			},
		]);
		expect(usedIn.usageGroups.map((group) => group.label)).toEqual([
			"Inline reference",
			"Screen reference",
		]);
		expect(
			usedIn.usageGroups.flatMap((group) =>
				group.rows.map((row) => row.groupLabel)
			)
		).not.toContain(RELATIONS_COPY.related);
		expect(JSON.stringify(usedIn)).not.toMatch(USAGE_METADATA);
		const mergedLabels = [
			...usedIn.relationBacklinks.map((group) => group.label),
			...usedIn.usageGroups.map((group) => group.label),
		];
		expect(new Set(mergedLabels).size).toBe(mergedLabels.length);
	});

	it("does not name or count inaccessible ends", () => {
		const usedIn = presentUsedIn({
			relationBacklinks: [],
			usageRows: [],
		});
		expect(usedIn.relationCount).toBe(0);
		expect(usedIn.relationBacklinks).toEqual([]);
		expect(usedIn.usageGroups).toEqual([]);
	});
});
