export const SMART_COLLECTIONS_COPY = {
	addCondition: "Add condition",
	allProjects: "All Projects",
	alreadyMatches: "The record already matches. No field write and no pin.",
	because: "Because",
	body: "Body",
	conditions: "Conditions",
	create: "Create Smart Collection",
	dragPreview:
		"This would write fields so the record matches. It does not pin membership.",
	dropHere: "Drop a record to preview a field write",
	empty: "No records match these conditions.",
	equals: "is",
	field: "Field",
	loading: "Loading…",
	members: "Members",
	name: "Name",
	newSmartCollection: "New Smart Collection",
	noPin: "Pinning is not allowed. Membership comes only from conditions.",
	notMembers: "Not members",
	pin: "Pin",
	project: "Project",
	readableSummary: "Summary",
	records: "Records",
	scope: "Scope",
	smartCollection: "Smart Collection",
	sourceKind: "Source",
	status: "Status",
	tags: "Tags",
	type: "Type",
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
