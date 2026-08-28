export const RELATIONS_COPY = {
	archived: "Archived",
	confirmRelation: "Confirm relation",
	derived: "Derived",
	inTrash: "In Trash",
	noAccess: "No access",
	noRelations: "No relations yet.",
	openSourceRecord: "Open source record",
	origin: "Origin",
	originLocation: "Origin Location",
	permanentlyDeleted: "Permanently deleted",
	preview: "Preview",
	redactedForSecurity: "Redacted for security",
	related: "Related",
	remove: "Remove",
	sourceItemGone: "Source item is gone",
	type: "Type",
} as const;

export const GENERIC_RELATION_TYPES = [
	RELATIONS_COPY.related,
	RELATIONS_COPY.origin,
] as const;

export type GenericRelationType = (typeof GENERIC_RELATION_TYPES)[number];
