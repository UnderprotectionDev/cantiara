import {
	toMainFlowFailureError,
	writeMainFlowFailureLog,
} from "@cantiara/api/client-shell-failure";

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
