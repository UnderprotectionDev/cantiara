import { COMPLETION_EFFECTS_COPY } from "@cantiara/auth/completion-effects-copy";
import {
	DECORATIVE_WAIT_MS,
	PREVIEW_MOTION_MS,
	defaultCompletionEffectPreference,
} from "@cantiara/auth/completion-effects-model";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";

import { orpc } from "@/utils/orpc";

import {
	getCompletionEffectsClientSession,
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
	const preference =
		preferenceQuery.data ?? defaultCompletionEffectPreference();
	const [nowMs, setNowMs] = useState(() => Date.now());

	useEffect(() => {
		if (session.feedback !== "effect") {
			return;
		}
		setNowMs(Date.now());
		const frame = window.setInterval(() => {
			setNowMs(Date.now());
		}, 50);
		return () => {
			window.clearInterval(frame);
		};
	}, [session.feedback, session.lastCloseCycleId]);

	if (session.feedback === "none") {
		return null;
	}

	const waitStartedAtMs =
		session.decorativeWaitUntilMs === null
			? null
			: session.decorativeWaitUntilMs - DECORATIVE_WAIT_MS;
	const playing =
		session.feedback === "effect" &&
		waitStartedAtMs !== null &&
		nowMs - waitStartedAtMs < PREVIEW_MOTION_MS;
	if (session.feedback === "effect" && !playing) {
		return null;
	}

	return (
		<div
			className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center p-3"
			data-completion-feedback={session.feedback}
		>
			{playing ? (
				<EffectPlay palette={preference.palette} theme={preference.theme} />
			) : null}
			{session.notice ? (
				<p
					className="relative z-10 rounded-none border border-border bg-background/95 px-3 py-2 text-sm shadow-sm"
					role="status"
				>
					{COMPLETION_EFFECTS_COPY.workCompleted}
				</p>
			) : null}
		</div>
	);
}
