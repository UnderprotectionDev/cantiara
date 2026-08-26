import { presentFailedMainFlow } from "@cantiara/api/client-shell-failure";

export type MainFlowFailureToastFlow = "query" | "write";

const TOAST_AUTO_DISMISS_MS = 4000;

export function mainFlowFailureToast(
	failure: unknown,
	retry?: () => void,
	flow: MainFlowFailureToastFlow = "write"
): {
	message: string;
	options: {
		action?: { label: "Retry"; onClick: () => void };
		closeButton: true;
		description: string;
		duration: number;
	};
} {
	const presented = presentFailedMainFlow(failure);
	const action =
		presented.retry && retry
			? { label: presented.retry, onClick: retry }
			: undefined;
	return {
		message: presented.reason,
		options: {
			action,
			closeButton: true,
			description: presented.description,
			duration:
				flow === "write" && action
					? Number.POSITIVE_INFINITY
					: TOAST_AUTO_DISMISS_MS,
		},
	};
}
