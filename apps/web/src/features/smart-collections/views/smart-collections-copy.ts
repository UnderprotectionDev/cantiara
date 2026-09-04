export const SMART_COLLECTIONS_COPY = {
	addCondition: "Add condition",
	allProjects: "All Projects",
	alreadyMatches: "The record already matches. No field write and no pin.",
	because: "Because",
	body: "Body",
	conditions: "Conditions",
	couldNotCreate: "Could not create this Smart Collection.",
	create: "Create Smart Collection",
	dragPreview:
		"This would write fields so the record matches. It does not pin membership.",
	dropHere: "Drop a record to preview a field write",
	empty: "No records match these conditions.",
	equals: "is",
	field: "Field",
	filter: "Filter",
	gallery: "Gallery",
	galleryUnavailable: "Gallery is not available for this source.",
	kanban: "Kanban",
	list: "List",
	loading: "Loading…",
	mayMissCollection: "This Work may not appear in the Smart Collection.",
	members: "Members",
	name: "Name",
	namedView: "Named view",
	newSmartCollection: "New Smart Collection",
	newWork: "New work",
	none: "None",
	noneYet: "No Smart Collection yet.",
	noPin: "Pinning is not allowed. Membership comes only from conditions.",
	notMembers: "Not members",
	pin: "Pin",
	project: "Project",
	purpose: "Purpose",
	readableSummary: "Summary",
	records: "Records",
	revert: "Revert",
	roadmap: "Roadmap",
	save: "Save",
	saveAs: "Save as",
	scope: "Scope",
	smartCollection: "Smart Collection",
	sort: "Sort",
	sourceKind: "Source",
	status: "Status",
	table: "Table",
	tags: "Tags",
	title: "Title",
	type: "Type",
	unsavedChanges: "Unsaved changes",
	value: "Value",
} as const;

export const BUILDER_FIELDS = [
	"status",
	"type",
	"projectId",
	"tagId",
	"scopeKind",
] as const;

export type BuilderField = (typeof BUILDER_FIELDS)[number];

export const SOURCE_KIND_OPTIONS = [
	"Work",
	"Document",
	"Wiki Document",
] as const;

export const GALLERY_SOURCE_KINDS = [
	"Document",
	"Project Wall",
	"User Flow",
	"Screen",
	"Moodboard",
	"Technical Diagram",
	"File Attachment",
	"Source",
	"Feedback",
] as const;

export const PRESENTATIONS = [
	"List",
	"Table",
	"Gallery",
	"Kanban",
	"Roadmap",
] as const;

export type Presentation = (typeof PRESENTATIONS)[number];

export function galleryAllowedFor(sourceKind: string): boolean {
	return (GALLERY_SOURCE_KINDS as readonly string[]).includes(sourceKind);
}

export function allowedPresentationsFor(sourceKind: string): Presentation[] {
	const base: Presentation[] = ["List", "Table"];
	if (galleryAllowedFor(sourceKind)) {
		base.push("Gallery");
	}
	if (sourceKind === "Work") {
		base.push("Kanban", "Roadmap");
	}
	return base;
}

export function presentationLabel(presentation: Presentation): string {
	switch (presentation) {
		case "Gallery":
			return SMART_COLLECTIONS_COPY.gallery;
		case "Kanban":
			return SMART_COLLECTIONS_COPY.kanban;
		case "List":
			return SMART_COLLECTIONS_COPY.list;
		case "Roadmap":
			return SMART_COLLECTIONS_COPY.roadmap;
		case "Table":
			return SMART_COLLECTIONS_COPY.table;
		default:
			return presentation;
	}
}
