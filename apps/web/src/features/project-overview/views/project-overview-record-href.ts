import { projectShellAnchor } from "../../project-shell/forms/project-shell-copy";

const AREA_HEADINGS = [
	"Work",
	"Documents",
	"Decisions",
	"Tests",
	"Production",
	"Risks",
] as const;

export function projectOverviewRecordHref(
	heading: string,
	recordId: string
): string {
	if (heading === "Work") {
		return `?work=${encodeURIComponent(recordId)}#work`;
	}
	if (heading === "Decisions") {
		return `?decision=${encodeURIComponent(recordId)}#decisions`;
	}
	if (heading === "Goals") {
		return `?goal=${encodeURIComponent(recordId)}#overview`;
	}
	if ((AREA_HEADINGS as readonly string[]).includes(heading)) {
		return `#${projectShellAnchor(heading)}`;
	}
	return `#${projectShellAnchor("Overview")}`;
}
