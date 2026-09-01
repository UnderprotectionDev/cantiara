import { z } from "zod";

export const ROADMAP_COPY = {
	allHorizons: "All",
	allWorkTypes: "All Work types",
	expectedOutcome: "Expected Outcome",
	groupField: "Group",
	horizon: "Horizon",
	later: "Later",
	next: "Next",
	now: "Now",
	openSourceRecord: "Open source record",
	place: "Place on horizon",
	primary: "Primary",
	problemOpportunity: "Problem/Opportunity",
	productDirection: "Product direction",
	roadmap: "Roadmap",
	saveNamedView: "Save named view",
	secondary: "Secondary",
	type: "Type",
} as const;

export const ROADMAP_HORIZONS = [
	ROADMAP_COPY.now,
	ROADMAP_COPY.next,
	ROADMAP_COPY.later,
] as const;

export type RoadmapHorizon = (typeof ROADMAP_HORIZONS)[number];

export const ROADMAP_PRESENTATIONS = [
	ROADMAP_COPY.productDirection,
	ROADMAP_COPY.allWorkTypes,
] as const;

export type RoadmapPresentation = (typeof ROADMAP_PRESENTATIONS)[number];

export const ROADMAP_GROUP_FIELDS = [
	ROADMAP_COPY.horizon,
	ROADMAP_COPY.type,
] as const;

export type RoadmapGroupField = (typeof ROADMAP_GROUP_FIELDS)[number];

export const ROADMAP_INNER_MEMBERSHIP = "derived" as const;

export const ROADMAP_WRITES = {
	backlogOrder: false,
	initiative: false,
	kanban: false,
	priorityCriterionValue: false,
	releaseCommitment: false,
	showOnRoadmap: false,
	startWork: false,
	status: false,
	targetDate: false,
	themeRecord: false,
} as const;

export const roadmapHorizonSchema = z.enum(ROADMAP_HORIZONS);
export const roadmapPresentationSchema = z.enum(ROADMAP_PRESENTATIONS);
export const roadmapGroupFieldSchema = z.enum(ROADMAP_GROUP_FIELDS);

export const listRoadmapQuerySchema = z.object({
	groupField: roadmapGroupFieldSchema.optional(),
	horizonFilter: roadmapHorizonSchema.optional(),
	namedViewId: z.string().min(1).optional(),
	presentation: roadmapPresentationSchema.optional(),
	projectId: z.string().min(1),
});

export type ListRoadmapQuery = z.infer<typeof listRoadmapQuerySchema>;

export const placeHorizonCommandSchema = z.object({
	horizon: roadmapHorizonSchema.nullable(),
	workId: z.string().min(1),
});

export type PlaceHorizonCommand = z.infer<typeof placeHorizonCommandSchema>;

export const saveRoadmapNamedViewCommandSchema = z.object({
	groupField: roadmapGroupFieldSchema.nullable().optional(),
	horizonFilter: roadmapHorizonSchema.nullable().optional(),
	name: z.string().min(1),
	presentation: roadmapPresentationSchema,
	projectId: z.string().min(1),
});

export type SaveRoadmapNamedViewCommand = z.infer<
	typeof saveRoadmapNamedViewCommandSchema
>;

export const roadmapWorkItemSchema = z.object({
	expectedOutcome: z.string().nullable(),
	horizon: roadmapHorizonSchema.nullable(),
	id: z.string().min(1),
	key: z.string().min(1),
	openSourceRecord: z.literal(ROADMAP_COPY.openSourceRecord),
	originWorkId: z.string().min(1).nullable(),
	problemOpportunity: z.string().nullable(),
	role: z.enum([ROADMAP_COPY.primary, ROADMAP_COPY.secondary]),
	status: z.string().min(1),
	title: z.string().min(1),
	type: z.string().min(1),
});

export type RoadmapWorkItem = z.infer<typeof roadmapWorkItemSchema>;

export const roadmapGroupSchema = z.object({
	field: z.union([roadmapGroupFieldSchema, z.null()]),
	items: z.array(roadmapWorkItemSchema),
	label: z.string().min(1),
});

export type RoadmapGroup = z.infer<typeof roadmapGroupSchema>;

export const roadmapNamedViewSchema = z.object({
	groupField: roadmapGroupFieldSchema.nullable(),
	horizonFilter: roadmapHorizonSchema.nullable(),
	id: z.string().min(1),
	name: z.string().min(1),
	presentation: roadmapPresentationSchema,
});

export type RoadmapNamedView = z.infer<typeof roadmapNamedViewSchema>;

export const roadmapViewSchema = z.object({
	copy: z.object({
		later: z.literal(ROADMAP_COPY.later),
		next: z.literal(ROADMAP_COPY.next),
		now: z.literal(ROADMAP_COPY.now),
		roadmap: z.literal(ROADMAP_COPY.roadmap),
	}),
	groups: z.array(roadmapGroupSchema),
	innerMembership: z.literal(ROADMAP_INNER_MEMBERSHIP),
	namedView: roadmapNamedViewSchema.nullable(),
	presentation: roadmapPresentationSchema,
	showOnRoadmap: z.literal(false),
	writes: z.object({
		backlogOrder: z.literal(false),
		initiative: z.literal(false),
		kanban: z.literal(false),
		priorityCriterionValue: z.literal(false),
		releaseCommitment: z.literal(false),
		showOnRoadmap: z.literal(false),
		startWork: z.literal(false),
		status: z.literal(false),
		targetDate: z.literal(false),
		themeRecord: z.literal(false),
	}),
});

export type RoadmapView = z.infer<typeof roadmapViewSchema>;

export function roadmapCatalog() {
	return {
		copy: ROADMAP_COPY,
		groupFields: ROADMAP_GROUP_FIELDS,
		horizons: ROADMAP_HORIZONS,
		innerMembership: ROADMAP_INNER_MEMBERSHIP,
		presentations: ROADMAP_PRESENTATIONS,
		writes: ROADMAP_WRITES,
	};
}

export function isRoadmapHorizon(value: string): value is RoadmapHorizon {
	return (ROADMAP_HORIZONS as readonly string[]).includes(value);
}

export function isRoadmapPresentation(
	value: string
): value is RoadmapPresentation {
	return (ROADMAP_PRESENTATIONS as readonly string[]).includes(value);
}

export function isRoadmapGroupField(value: string): value is RoadmapGroupField {
	return (ROADMAP_GROUP_FIELDS as readonly string[]).includes(value);
}
