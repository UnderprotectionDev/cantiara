import { findWireframeVersionRow, type ScreenDb } from "./screen-store";
import { parseWireframeDocument } from "./wireframe-document";

export async function wireframeOriginComponentExists(
	db: ScreenDb,
	input: { componentId: string; ownerId: string; sourceVersion: string }
): Promise<boolean> {
	const versionNumber = Number(input.sourceVersion);
	if (!Number.isInteger(versionNumber) || versionNumber < 1) {
		return false;
	}
	const row = await findWireframeVersionRow(db, {
		screenId: input.ownerId,
		versionNumber,
	});
	if (!row) {
		return false;
	}
	const parsed = parseWireframeDocument(row.document);
	if (parsed.status !== "ok") {
		return false;
	}
	return parsed.document.nodes.some((node) => node.id === input.componentId);
}
