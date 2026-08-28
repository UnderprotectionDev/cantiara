import { z } from "zod";

import {
	WORK_TYPES,
	type WorkType,
} from "../../work-lifecycle/server/work-lifecycle-model";

export const WORK_DRAFTS_COPY = {
	create: "Create",
	delete: "Delete",
	draft: "Draft",
	drafts: "Drafts",
	lastSaved: "Last saved",
	loading: "Loading…",
	noDrafts: "No drafts.",
	resume: "Resume",
	unsavedChangesMayBeLost: "Unsaved changes may be lost",
} as const;

export const DRAFT_SURFACE_EXCLUSION = {
	backlog: false,
	export: false,
	kanban: false,
	mainRecord: false,
	notification: false,
	publish: false,
	relation: false,
	search: false,
	share: false,
	smartCollection: false,
} as const;

export type DraftSurfaceEligibility = typeof DRAFT_SURFACE_EXCLUSION;

export const workDraftTypeSchema = z.enum(WORK_TYPES);

export const workDraftFormSchema = z.object({
	customFieldValues: z.record(z.string(), z.string()),
	projectId: z.string().min(1).nullable(),
	title: z.string(),
	type: workDraftTypeSchema,
});

export type WorkDraftFormState = z.infer<typeof workDraftFormSchema>;

export interface WorkDraftView {
	captureInboxItem: false;
	documentDraft: false;
	form: WorkDraftFormState;
	id: string;
	kind: "work-draft";
	mainRecord: false;
	updatedAt: Date;
	workKey: null;
}

export interface WorkCustomFieldDefinition {
	boundRecordType: "Work";
	id: string;
	label: string;
}

export function emptyWorkDraftForm(): WorkDraftFormState {
	return {
		customFieldValues: {},
		projectId: null,
		title: "",
		type: "Task" satisfies WorkType,
	};
}
