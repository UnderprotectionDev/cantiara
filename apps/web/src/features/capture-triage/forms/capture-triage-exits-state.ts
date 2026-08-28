import { CLIENT_SHELL_COPY } from "@cantiara/api/client-shell-failure";

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

export function convertTargetScopeLine(scope: {
	heading: string;
	projectId: string | null;
}): string {
	return scope.projectId
		? `${scope.heading} ${scope.projectId}`
		: scope.heading;
}

export function convertFinalizeFailedLine(explanation?: {
	reason: string;
	retryBound: "none" | "once";
	supportReference: string;
	written: boolean;
}): string {
	if (!explanation) {
		return `${CLIENT_SHELL_COPY.failed} ${CLIENT_SHELL_COPY.notWritten} ${CLIENT_SHELL_COPY.retryOnce}`;
	}
	const retry =
		explanation.retryBound === "none"
			? CLIENT_SHELL_COPY.doNotRetry
			: CLIENT_SHELL_COPY.retryOnce;
	const reference = explanation.supportReference
		? `${CLIENT_SHELL_COPY.supportReference} ${explanation.supportReference}`
		: "";
	return [
		`${explanation.reason} ${CLIENT_SHELL_COPY.notWritten}`,
		retry,
		reference,
	]
		.filter((part) => part.length > 0)
		.join(" ");
}

export interface MergeUndoPreviewLine {
	id: string;
	text: string;
}

export function mergeUndoPreviewLines(input: {
	bindsToRemove: Array<{
		relation: string;
		targetId: string;
	}>;
	copy: { evidence: string; origin: string };
	restoredItem: {
		attachmentRef: string | null;
		body: string;
		capturedAt: Date | string;
		link: string;
		origin: string;
	};
}): MergeUndoPreviewLine[] {
	const capturedAt =
		input.restoredItem.capturedAt instanceof Date
			? input.restoredItem.capturedAt.toISOString()
			: input.restoredItem.capturedAt;
	const lines: MergeUndoPreviewLine[] = [
		{ id: "body", text: input.restoredItem.body },
	];
	if (input.restoredItem.link) {
		lines.push({ id: "link", text: input.restoredItem.link });
	}
	if (input.restoredItem.attachmentRef) {
		lines.push({ id: "attachment", text: input.restoredItem.attachmentRef });
	}
	lines.push({ id: "capturedAt", text: capturedAt });
	if (input.restoredItem.origin) {
		lines.push({ id: "origin", text: input.restoredItem.origin });
	}
	for (const bind of input.bindsToRemove) {
		lines.push({
			id: `bind-${bind.targetId}`,
			text: `${bind.relation === "origin" ? input.copy.origin : input.copy.evidence} ${bind.targetId}`,
		});
	}
	return lines;
}
