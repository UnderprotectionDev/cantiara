import { presentFailedMainFlow } from "@cantiara/api/client-shell-failure";

export function mainFlowFailureToast(
	failure: unknown,
	retry?: () => void
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
	return {
		message: presented.reason,
		options: {
			action:
				presented.retry && retry
					? { label: presented.retry, onClick: retry }
					: undefined,
			closeButton: true,
			description: presented.description,
			duration: Number.POSITIVE_INFINITY,
		},
	};
}
