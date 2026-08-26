import { toast } from "sonner";

import { mainFlowFailureToast } from "./client-shell";

export function showMainFlowFailure(failure: unknown, retry?: () => void) {
	const payload = mainFlowFailureToast(failure, retry);
	toast.error(payload.message, payload.options);
}
