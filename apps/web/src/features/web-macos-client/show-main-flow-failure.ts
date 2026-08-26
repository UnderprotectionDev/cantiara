import { toast } from "sonner";

import {
	type MainFlowFailureToastFlow,
	mainFlowFailureToast,
} from "./client-shell";

export function showMainFlowFailure(
	failure: unknown,
	retry?: () => void,
	flow: MainFlowFailureToastFlow = "write"
) {
	const payload = mainFlowFailureToast(failure, retry, flow);
	toast.error(payload.message, payload.options);
}

export function showQueryMainFlowFailure(failure: unknown, retry?: () => void) {
	showMainFlowFailure(failure, retry, "query");
}
