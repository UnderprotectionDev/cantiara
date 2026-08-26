export type ConvertTargetKind = "work" | "document" | "file-attachment";

export interface SimilarMatchView {
	basis: { excerpt: string; kind: string };
	id: string;
	projectId: string;
	projectName: string;
	title: string;
}

export interface OtherProjectGroup {
	matches: SimilarMatchView[];
	projectName: string;
}

export function otherProjectGroups(
	matches: SimilarMatchView[]
): OtherProjectGroup[] {
	const byName = new Map<string, SimilarMatchView[]>();
	for (const match of matches) {
		const existing = byName.get(match.projectName);
		if (existing) {
			existing.push(match);
			continue;
		}
		byName.set(match.projectName, [match]);
	}
	return [...byName.entries()]
		.sort(([left], [right]) => left.localeCompare(right, "en-US"))
		.map(([projectName, grouped]) => ({
			matches: grouped,
			projectName,
		}));
}

export function convertTargetOptions(copy: {
	document: string;
	fileAttachment: string;
	work: string;
}): Array<{ id: ConvertTargetKind; label: string }> {
	return [
		{ id: "work", label: copy.work },
		{ id: "document", label: copy.document },
		{ id: "file-attachment", label: copy.fileAttachment },
	];
}
