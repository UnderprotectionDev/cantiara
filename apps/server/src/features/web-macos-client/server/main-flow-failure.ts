import { toMainFlowFailureError } from "@cantiara/api/client-shell-failure";

interface ProcedureInterceptorOptions {
	context: {
		log?: unknown;
	};
	next: () => Promise<unknown>;
}

export async function attachMainFlowFailure(
	options: ProcedureInterceptorOptions
): Promise<unknown> {
	try {
		return await options.next();
	} catch (error) {
		throw toMainFlowFailureError(error, {
			write: (record) => {
				writeMainFlowFailureLog(options.context.log, record);
			},
		});
	}
}

export function writeMainFlowFailureLog(
	log: unknown,
	record: {
		reason: string;
		retryBound: "none" | "once";
		supportReference: string;
		written: boolean;
	}
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
