import { ORPCError } from "@orpc/server";

export const CLIENT_SHELL_COPY = {
	doNotRetry: "Do not retry.",
	failed: "This action could not be completed.",
	notWritten: "Data was not written.",
	retry: "Retry",
	retryOnce: "You can retry once.",
	supportReference: "Support reference",
	written: "Data was written.",
} as const;

export interface MainFlowFailureLogRecord {
	reason: string;
	retryBound: "none" | "once";
	supportReference: string;
	written: boolean;
}

export interface MainFlowFailureLogSink {
	write: (record: MainFlowFailureLogRecord) => void;
}

export interface MainFlowFailurePackage {
	reason: string;
	retryBound: "none" | "once";
	supportReference: string;
	written: boolean;
}

export interface PresentedMainFlowFailure {
	description: string;
	reason: string;
	retry?: "Retry";
	retryBound: string;
	supportReference: string;
	supportReferenceLabel: "Support reference";
	writeOutcome: string;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SESSION_SECRET = /session_token=[^;\s]+/gi;

export function issueMainFlowFailure(
	input: {
		privateContent?: string[];
		reason: string;
		trackingId?: string;
		written: boolean;
	},
	sink?: MainFlowFailureLogSink
): MainFlowFailurePackage {
	const retryBound = input.written ? "none" : "once";
	const supportReference = input.trackingId ?? createTrackingId();
	const reason = safeReason(input.reason, input.privateContent ?? []);
	const record: MainFlowFailurePackage = {
		reason,
		retryBound,
		supportReference,
		written: input.written,
	};
	sink?.write({
		reason: record.reason,
		retryBound: record.retryBound,
		supportReference: record.supportReference,
		written: record.written,
	});
	return record;
}

export function toMainFlowFailureError(
	error: unknown,
	sink?: MainFlowFailureLogSink,
	options?: {
		privateContent?: string[];
		trackingId?: string;
		written?: boolean;
	}
): ORPCError<string, MainFlowFailurePackage> {
	const existing = extractPackage(error);
	if (existing && error instanceof ORPCError) {
		return error as ORPCError<string, MainFlowFailurePackage>;
	}
	const issued =
		existing ??
		issueMainFlowFailure(
			{
				privateContent: options?.privateContent,
				reason: messageFrom(error),
				trackingId: options?.trackingId,
				written: options?.written ?? writtenFrom(error),
			},
			sink
		);
	if (error instanceof ORPCError) {
		return new ORPCError(error.code, {
			data: issued,
			message: issued.reason,
			status: error.status,
		});
	}
	return new ORPCError("INTERNAL_SERVER_ERROR", {
		data: issued,
		message: issued.reason,
	});
}

export function presentFailedMainFlow(
	failure: MainFlowFailurePackage | unknown
): PresentedMainFlowFailure {
	const packaged = extractPackage(failure) ?? localFailure(failure);
	const writeOutcome = packaged.written
		? CLIENT_SHELL_COPY.written
		: CLIENT_SHELL_COPY.notWritten;
	const retryBound =
		packaged.retryBound === "once"
			? CLIENT_SHELL_COPY.retryOnce
			: CLIENT_SHELL_COPY.doNotRetry;
	const descriptionParts: string[] = [writeOutcome, retryBound];
	if (packaged.supportReference.length > 0) {
		descriptionParts.push(
			`${CLIENT_SHELL_COPY.supportReference} ${packaged.supportReference}`
		);
	}

	return {
		description: descriptionParts.join(" "),
		reason: packaged.reason,
		retry: packaged.retryBound === "once" ? CLIENT_SHELL_COPY.retry : undefined,
		retryBound,
		supportReference: packaged.supportReference,
		supportReferenceLabel: CLIENT_SHELL_COPY.supportReference,
		writeOutcome,
	};
}

export function isMainFlowFailurePackage(
	value: unknown
): value is MainFlowFailurePackage {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const record = value as Record<string, unknown>;
	return (
		typeof record.reason === "string" &&
		(record.retryBound === "none" || record.retryBound === "once") &&
		typeof record.supportReference === "string" &&
		typeof record.written === "boolean"
	);
}

function extractPackage(value: unknown): MainFlowFailurePackage | undefined {
	if (isMainFlowFailurePackage(value)) {
		return value;
	}
	if (typeof value === "object" && value !== null && "data" in value) {
		const { data } = value as { data: unknown };
		if (isMainFlowFailurePackage(data)) {
			return data;
		}
	}
}

function localFailure(value: unknown): MainFlowFailurePackage {
	return {
		reason: safeReason(messageFrom(value), []),
		retryBound: "once",
		supportReference: "",
		written: false,
	};
}

function writtenFrom(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		"written" in value &&
		(value as { written: unknown }).written === true
	);
}

function messageFrom(value: unknown): string {
	if (value instanceof Error) {
		return value.message;
	}
	if (
		typeof value === "object" &&
		value !== null &&
		"message" in value &&
		typeof value.message === "string"
	) {
		return value.message;
	}
	return CLIENT_SHELL_COPY.failed;
}

function safeReason(reason: string, privateContent: string[]): string {
	let next = reason;
	for (const piece of privateContent) {
		if (piece.length > 0) {
			next = next.split(piece).join("");
		}
	}
	next = next
		.replace(JWT, "")
		.replace(BEARER, "")
		.replace(SESSION_SECRET, "")
		.replace(EMAIL, "")
		.replace(/\s+/g, " ")
		.trim();
	if (next !== reason.trim() || next.length === 0) {
		return CLIENT_SHELL_COPY.failed;
	}
	return next;
}

export function writeMainFlowFailureLog(
	log: unknown,
	record: MainFlowFailureLogRecord
) {
	if (
		typeof log !== "object" ||
		log === null ||
		!("error" in log) ||
		typeof log.error !== "function"
	) {
		return;
	}
	const error = log.error as (
		tag: string,
		context: Record<string, string | boolean>
	) => void;
	error("main-flow-failure", {
		reason: record.reason,
		retryBound: record.retryBound,
		supportReference: record.supportReference,
		written: record.written,
	});
}

function createTrackingId(): string {
	const bytes = new Uint8Array(4);
	crypto.getRandomValues(bytes);
	return `CANT-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
		.join("")
		.toUpperCase()}`;
}
