import { createHash } from "node:crypto";

export const MUTATION_COPY = {
	cancel: "Cancel",
	conflict: "Conflict",
	currentValue: "Current value",
	finalizing: "Finalizing",
	retry: "Retry",
} as const;

export const MUTATION_ACTOR = {
	authorizedIntegration: "Authorized integration",
	github: "GitHub",
	systemAutomation: "System automation",
	user: "User",
} as const;

export type MutationActor =
	(typeof MUTATION_ACTOR)[keyof typeof MUTATION_ACTOR];

export const HUMAN_ORIGIN = "human";
export const NON_HUMAN_ORIGINS = [
	"authorized-integration",
	"github",
	"system-automation",
] as const;

export type NonHumanOrigin = (typeof NON_HUMAN_ORIGINS)[number];
export type MutationOrigin = typeof HUMAN_ORIGIN | NonHumanOrigin;

export function payloadFingerprint(payload: unknown): string {
	return createHash("sha256").update(canonicalize(payload)).digest("hex");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function advisoryKeys(label: string): [number, number] {
	const digest = createHash("sha256").update(label).digest();
	return [digest.readInt32BE(0), digest.readInt32BE(4)];
}

export function actorFor(origin: MutationOrigin): MutationActor {
	if (origin === HUMAN_ORIGIN) {
		return MUTATION_ACTOR.user;
	}
	if (origin === "github") {
		return MUTATION_ACTOR.github;
	}
	if (origin === "authorized-integration") {
		return MUTATION_ACTOR.authorizedIntegration;
	}
	return MUTATION_ACTOR.systemAutomation;
}

function canonicalize(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map(canonicalize).join(",")}]`;
	}
	const record = value as Record<string, unknown>;
	const keys = Object.keys(record).sort();
	return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}
