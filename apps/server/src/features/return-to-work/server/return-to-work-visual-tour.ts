import {
	planVisualTour,
	type SinceYouLastLookedEvent,
	VISUAL_TOUR_SKIP_LABEL,
	VISUAL_TOUR_WRITES,
	type VisualTourObjectKind,
	type VisualTourPlanStep,
	type VisualTourSkipReason,
	type VisualTourTarget,
} from "./return-to-work-model";

export interface CanvasViewportSnapshot {
	id: string;
}

export type VisualTourResolveResult =
	| { placementId: string; status: "placed" }
	| { reason: VisualTourSkipReason; status: "skipped" };

export interface CanvasViewportApi {
	captureStartViewport: () => CanvasViewportSnapshot;
	fitVisibleContent: () => void;
	highlightAndPanTo: (placementId: string) => void;
	resolveTarget: (target: VisualTourTarget) => VisualTourResolveResult;
	restoreViewport: (snapshot: CanvasViewportSnapshot) => void;
	startViewportStillMeaningful: (snapshot: CanvasViewportSnapshot) => boolean;
}

export interface CurrentVisualView {
	deletedIds?: ReadonlySet<string>;
	inaccessibleIds?: ReadonlySet<string>;
	placed: ReadonlyArray<{ id: string; kind: VisualTourObjectKind }>;
}

export function resolveExactObjectInCurrentView(
	target: VisualTourTarget,
	current: CurrentVisualView
): VisualTourResolveResult {
	if (current.deletedIds?.has(target.objectId)) {
		return { reason: "deleted", status: "skipped" };
	}
	if (current.inaccessibleIds?.has(target.objectId)) {
		return { reason: "inaccessible", status: "skipped" };
	}
	const hit = current.placed.find(
		(row) => row.id === target.objectId && row.kind === target.objectKind
	);
	if (!hit) {
		return { reason: "unplaceable", status: "skipped" };
	}
	return { placementId: hit.id, status: "placed" };
}

export type VisualTourStepView =
	| {
			kind: "shown";
			occurredAt: string;
			occurredAtDisplay: string;
			placementId: string;
			sourceKey: string;
			sourceTitle: string;
			step: VisualTourPlanStep;
			surfaceLabel: string;
			whyShown: string;
	  }
	| {
			kind: "skipped";
			reason: VisualTourSkipReason;
			reasonLabel: string;
			step: VisualTourPlanStep;
	  };

export interface VisualTourSession {
	close: () => void;
	current: VisualTourStepView | null;
	remainderCount: number;
	remainderOpensInList: true;
	skip: () => void;
	writes: typeof VISUAL_TOUR_WRITES;
}

export function startVisualTour(input: {
	canvas: CanvasViewportApi;
	events: readonly SinceYouLastLookedEvent[];
	formatOccurredAt: (occurredAt: string) => string;
}): VisualTourSession {
	const startViewport = input.canvas.captureStartViewport();
	const plan = planVisualTour(input.events, {
		formatOccurredAt: input.formatOccurredAt,
	});
	let index = 0;
	let current: VisualTourStepView | null = null;

	function present(stepIndex: number): VisualTourStepView | null {
		const step = plan.steps[stepIndex];
		if (!step) {
			return null;
		}
		const resolved = input.canvas.resolveTarget(step.target);
		if (resolved.status === "placed") {
			input.canvas.highlightAndPanTo(resolved.placementId);
			return {
				kind: "shown",
				occurredAt: step.occurredAt,
				occurredAtDisplay: step.occurredAtDisplay,
				placementId: resolved.placementId,
				sourceKey: step.sourceKey,
				sourceTitle: step.sourceTitle,
				step,
				surfaceLabel: step.surfaceLabel,
				whyShown: step.whyShown,
			};
		}
		return {
			kind: "skipped",
			reason: resolved.reason,
			reasonLabel: VISUAL_TOUR_SKIP_LABEL[resolved.reason],
			step,
		};
	}

	current = present(0);

	return {
		close() {
			if (input.canvas.startViewportStillMeaningful(startViewport)) {
				input.canvas.restoreViewport(startViewport);
				return;
			}
			input.canvas.fitVisibleContent();
		},
		get current() {
			return current;
		},
		remainderCount: plan.remainderCount,
		remainderOpensInList: true,
		skip() {
			index += 1;
			current = present(index);
		},
		writes: VISUAL_TOUR_WRITES,
	};
}
