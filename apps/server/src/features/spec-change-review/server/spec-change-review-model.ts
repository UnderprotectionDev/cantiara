import { diffLines } from "diff";

import {
	HEADING_LINE,
	stripSectionIds,
} from "../../documents/server/documents-live";

export const SPEC_CHANGE_REVIEW_COPY = {
	documentLevelCandidate: "Document-level candidate",
	notAffected: "Not affected",
	note: "Note",
	primarySpec: "Primary spec",
	reviewed: "Reviewed",
	specChangeReview: "Spec Change Review",
	version: "Version",
	waiting: "Waiting",
	why: "Why",
} as const;

export const SPEC_CHANGE_REVIEW_STATUSES = [
	SPEC_CHANGE_REVIEW_COPY.waiting,
	SPEC_CHANGE_REVIEW_COPY.reviewed,
	SPEC_CHANGE_REVIEW_COPY.notAffected,
] as const;

export type SpecChangeReviewStatus =
	(typeof SPEC_CHANGE_REVIEW_STATUSES)[number];

export const SPEC_CHANGE_REVIEW_COUNTERPARTS = {
	ai: false,
	bulkAllAffected: false,
	feedbackReviewed: false,
	refutedAssumptionReview: false,
	semanticPrediction: false,
	titleSimilarity: false,
	workWorkflowStatus: false,
	writesCandidateWork: false,
} as const;

export function specChangeReviewCatalog(): {
	copy: typeof SPEC_CHANGE_REVIEW_COPY;
	counterparts: typeof SPEC_CHANGE_REVIEW_COUNTERPARTS;
	statuses: typeof SPEC_CHANGE_REVIEW_STATUSES;
} {
	return {
		copy: SPEC_CHANGE_REVIEW_COPY,
		counterparts: SPEC_CHANGE_REVIEW_COUNTERPARTS,
		statuses: SPEC_CHANGE_REVIEW_STATUSES,
	};
}

export function isSpecChangeReviewStatus(
	value: string
): value is SpecChangeReviewStatus {
	return (SPEC_CHANGE_REVIEW_STATUSES as readonly string[]).includes(value);
}

export function headingForSectionId(
	body: string,
	sectionId: string
): string | null {
	return (
		parseSections(body).find((section) => section.sectionId === sectionId)
			?.heading ?? null
	);
}

export function headingContainingText(
	body: string,
	needle: string
): string | null {
	if (needle.length === 0) {
		return null;
	}
	return (
		parseSections(body).find((section) => section.body.includes(needle))
			?.heading ?? null
	);
}

export interface SpecChangeReviewSection {
	heading: string;
	newBody: string;
	previousBody: string;
}

export interface SpecChangeReviewVersion {
	body: string;
	id: string;
	revision: number;
	title: string;
}

export interface SpecChangeReviewCandidateView {
	brokenReason: string | null;
	changedSection: string | null;
	documentLevel: boolean;
	id: string;
	note: string;
	openTarget:
		| { kind: "broken-reference"; reason: string }
		| { kind: "record"; title: string };
	recordId: string;
	recordKind: string;
	reviewStatus: SpecChangeReviewStatus;
	title: string | null;
	why: readonly string[];
}

export interface SpecChangeReviewView {
	candidates: SpecChangeReviewCandidateView[];
	changedSections: SpecChangeReviewSection[];
	featureId: string;
	id: string;
	newVersion: SpecChangeReviewVersion;
	previousVersion: SpecChangeReviewVersion;
	primarySpec: { id: string; title: string };
}

interface ParsedSection {
	body: string;
	heading: string;
	sectionId: string | null;
}

export function presentChangedSections(
	previousBody: string,
	newBody: string
): SpecChangeReviewSection[] {
	const previous = parseSections(stripSectionIds(previousBody));
	const next = parseSections(stripSectionIds(newBody));
	const usedNext = new Set<number>();
	const changed: SpecChangeReviewSection[] = [];
	for (const left of previous) {
		const rightIndex = findSectionIndex(next, left, usedNext);
		if (rightIndex === -1) {
			if (sectionChanged(left.body, "")) {
				changed.push({
					heading: left.heading,
					newBody: "",
					previousBody: left.body,
				});
			}
			continue;
		}
		usedNext.add(rightIndex);
		const right = next[rightIndex];
		if (!(right && sectionChanged(left.body, right.body))) {
			continue;
		}
		changed.push({
			heading: right.heading || left.heading,
			newBody: right.body,
			previousBody: left.body,
		});
	}
	for (const [index, right] of next.entries()) {
		if (usedNext.has(index)) {
			continue;
		}
		if (!sectionChanged("", right.body)) {
			continue;
		}
		changed.push({
			heading: right.heading,
			newBody: right.body,
			previousBody: "",
		});
	}
	return changed;
}

function findSectionIndex(
	sections: readonly ParsedSection[],
	needle: ParsedSection,
	used: ReadonlySet<number>
): number {
	if (needle.sectionId) {
		const byId = sections.findIndex(
			(section, index) =>
				!used.has(index) && section.sectionId === needle.sectionId
		);
		if (byId >= 0) {
			return byId;
		}
	}
	if (needle.heading.length === 0) {
		return sections.findIndex(
			(section, index) => !used.has(index) && section.heading.length === 0
		);
	}
	return sections.findIndex(
		(section, index) => !used.has(index) && section.heading === needle.heading
	);
}

function parseSections(markdown: string): ParsedSection[] {
	const lines = markdown.split("\n");
	const sections: ParsedSection[] = [];
	let heading = "";
	let sectionId: string | null = null;
	let chunk: string[] = [];
	let inFence = false;
	const flush = () => {
		if (chunk.length === 0 && heading.length === 0) {
			return;
		}
		sections.push({
			body: chunk.join("\n"),
			heading,
			sectionId,
		});
		chunk = [];
		heading = "";
		sectionId = null;
	};
	for (const line of lines) {
		if (line.startsWith("```")) {
			inFence = !inFence;
		}
		const match = inFence ? null : HEADING_LINE.exec(line);
		if (match) {
			flush();
			heading = match[2]?.trim() ?? "";
			sectionId = match[3] ?? null;
			chunk = [line];
			continue;
		}
		chunk.push(line);
	}
	flush();
	return sections;
}

function sectionChanged(previousBody: string, newBody: string): boolean {
	return diffLines(previousBody, newBody).some(
		(part) => part.added === true || part.removed === true
	);
}
