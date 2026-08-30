import { COMPLETION_EFFECTS_COPY } from "@cantiara/auth/completion-effects-copy";
import {
	type CompletionEffectsPresentation,
	visibleSuccessPresentation,
} from "@cantiara/auth/completion-effects-model";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";

import { orpc } from "@/utils/orpc";

import {
	clearCompletionEffectsPresentation,
	getCompletionEffectsClientSession,
	readCompletionEffectsPresentation,
	requestReopenConfirmationFromNotice,
	sampleDrawingBudget,
	subscribeCompletionEffectsClientSession,
} from "../completion-effects-session";
import { EffectPlay } from "./effect-sample";

export function CompletionEffectsLayer() {
	const session = useSyncExternalStore(
		subscribeCompletionEffectsClientSession,
		getCompletionEffectsClientSession,
		getCompletionEffectsClientSession
	);
	const preferenceQuery = useQuery(orpc.completionEffects.get.queryOptions());
	const [nowMs, setNowMs] = useState(() => Date.now());
	const [presentation, setPresentation] =
		useState<CompletionEffectsPresentation>(readCompletionEffectsPresentation);

	useEffect(() => {
		const stopSample = sampleDrawingBudget(() => {
			setPresentation(readCompletionEffectsPresentation());
		});
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const onMotion = () => {
			setPresentation(readCompletionEffectsPresentation());
		};
		media.addEventListener("change", onMotion);
		return () => {
			stopSample();
			media.removeEventListener("change", onMotion);
			clearCompletionEffectsPresentation();
		};
	}, []);

	useEffect(() => {
		if (session.feedback !== "effect" || session.noticeUntilMs === null) {
			return;
		}
		return sampleDrawingBudget(() => {
			setPresentation(readCompletionEffectsPresentation());
		});
	}, [session.feedback, session.noticeUntilMs]);

	useEffect(() => {
		if (session.noticeUntilMs === null && session.feedback !== "effect") {
			return;
		}
		setNowMs(Date.now());
		const tick = window.setInterval(() => {
			setNowMs(Date.now());
		}, 50);
		return () => {
			window.clearInterval(tick);
		};
	}, [session.feedback, session.noticeUntilMs]);

	const visible = visibleSuccessPresentation(session, nowMs, presentation);
	if (!(visible.notice || visible.decorativeLayer)) {
		return null;
	}

	return (
		<div
			className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center overflow-hidden p-3"
			data-completion-feedback={session.feedback}
			data-decorative-layer={visible.decorativeLayer ? "on" : "off"}
		>
			{visible.decorativeLayer && preferenceQuery.data ? (
				<EffectPlay
					palette={preferenceQuery.data.palette}
					theme={preferenceQuery.data.theme}
				/>
			) : null}
			{visible.notice ? (
				<div
					className="pointer-events-auto relative z-10 max-w-full rounded-none border border-border bg-background px-3 py-2 text-foreground text-sm shadow-sm"
					data-work-completed-notice=""
				>
					<p aria-live={visible.ariaLive} role="status">
						{COMPLETION_EFFECTS_COPY.workCompleted}
					</p>
					{session.workStatus ? (
						<p className="mt-1 text-muted-foreground">{session.workStatus}</p>
					) : null}
					<Button
						className="mt-2"
						onClick={requestReopenConfirmationFromNotice}
						size="sm"
						type="button"
						variant="outline"
					>
						{COMPLETION_EFFECTS_COPY.reopen}
					</Button>
				</div>
			) : null}
		</div>
	);
}
