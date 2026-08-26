import { z } from "zod";

export const STARTER_CONFIGURATIONS = [
	"Blank Project",
	"Solo SaaS",
	"Open Source Library",
	"Mobile Application",
] as const;

export type StarterConfiguration = (typeof STARTER_CONFIGURATIONS)[number];

export const PROJECT_LIFECYCLE = {
	abandoned: "Abandoned",
	active: "Active",
	completed: "Completed",
	pending: "Pending",
} as const;

export const PROJECT_SHELL_COPY = {
	createProject: "Create Project",
	logo: "Logo",
	problem: "Problem",
	projectName: "Project Name",
	purpose: "Purpose",
	scope: "Scope",
	shortCode: "Short code",
	shortCodeLocked: "Short code is locked after the first Work.",
	starterConfiguration: "Starter Configuration",
	targetDate: "Target date",
} as const;

export const SHORT_CODE_MIN = 2;
export const SHORT_CODE_MAX = 6;
const SHORT_CODE_FALLBACK = "PRJ";
const SHORT_CODE_PATTERN = /^[A-Z0-9]{2,6}$/;
const TARGET_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const projectViewSchema = z.object({
	id: z.string().min(1),
	lifecycleStatus: z.literal(PROJECT_LIFECYCLE.active),
	logoFileName: z.string().min(1).nullable(),
	name: z.string().min(1),
	problem: z.string().min(1).nullable(),
	purpose: z.string().min(1).nullable(),
	revision: z.number().int().positive(),
	scope: z.string().min(1).nullable(),
	shortCode: z.string().min(SHORT_CODE_MIN).max(SHORT_CODE_MAX),
	shortCodeLocked: z.boolean(),
	starterConfiguration: z.enum(STARTER_CONFIGURATIONS),
	targetDate: z.string().nullable(),
	workspaceId: z.string().min(1),
});

export type ProjectView = z.infer<typeof projectViewSchema>;

export const createProjectPayloadSchema = z.object({
	logoFileName: z.string().nullable().optional(),
	name: z.string().optional(),
	problem: z.string().optional(),
	purpose: z.string().optional(),
	scope: z.string().optional(),
	shortCode: z.string().optional(),
	starterConfiguration: z.string().optional(),
	targetDate: z.string().nullable().optional(),
});

export type CreateProjectPayload = z.infer<typeof createProjectPayloadSchema>;

export const createProjectCommandSchema = z.object({
	actorId: z.string().min(1),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	payload: createProjectPayloadSchema,
	workspaceId: z.string().min(1),
});

export type CreateProjectCommand = z.infer<typeof createProjectCommandSchema>;

export const updateShortCodeCommandSchema = z.object({
	actorId: z.string().min(1),
	baseRevision: z.number().int().nonnegative(),
	idempotencyKey: z.string().min(1),
	origin: z.literal("human"),
	projectId: z.string().min(1),
	shortCode: z.string().min(1),
});

export type UpdateShortCodeCommand = z.infer<
	typeof updateShortCodeCommandSchema
>;

export type ProjectShellOutcome =
	| { project: ProjectView; status: "committed" }
	| { project: ProjectView; status: "replayed" }
	| { conflict: "Conflict"; status: "conflict" }
	| {
			current: ProjectView;
			currentValueLabel: "Current value";
			status: "stale";
	  }
	| {
			reason:
				| "missing-idempotency-key"
				| "missing-project-name"
				| "missing-starter-configuration"
				| "short-code-invalid"
				| "short-code-locked"
				| "short-code-taken"
				| "target-not-found"
				| "unknown-starter-configuration";
			status: "rejected";
	  };

export function isStarterConfiguration(
	value: string
): value is StarterConfiguration {
	return (STARTER_CONFIGURATIONS as readonly string[]).includes(value);
}

export function suggestShortCodeFromName(name: string): string {
	const letters = name.toUpperCase().replace(/[^A-Z0-9]+/g, "");
	if (letters.length >= 3) {
		return letters.slice(0, 3);
	}
	if (letters.length >= SHORT_CODE_MIN) {
		return letters;
	}
	return SHORT_CODE_FALLBACK;
}

export function suggestAvailableShortCode(
	name: string,
	reserved: ReadonlySet<string>
): string {
	const base = suggestShortCodeFromName(name);
	if (!reserved.has(base)) {
		return base;
	}
	for (let n = 2; n < 1000; n += 1) {
		const suffix = String(n);
		const truncated = base.slice(0, SHORT_CODE_MAX - suffix.length);
		const candidate = `${truncated}${suffix}`;
		if (!reserved.has(candidate)) {
			return candidate;
		}
	}
	return SHORT_CODE_FALLBACK;
}

export function normalizeShortCode(value: string): string | null {
	const normalized = value.trim().toUpperCase();
	if (!SHORT_CODE_PATTERN.test(normalized)) {
		return null;
	}
	return normalized;
}

export function optionalText(value: string | null | undefined): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export function optionalDate(value: string | null | undefined): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return null;
	}
	if (!TARGET_DATE_PATTERN.test(trimmed)) {
		return null;
	}
	return trimmed;
}
