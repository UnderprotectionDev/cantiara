import {
	type CompletionEffectTheme,
	paletteSwatches,
} from "@cantiara/auth/completion-effects-model";

const SAMPLE_LAYOUT: Record<
	CompletionEffectTheme,
	readonly { left: string; size: string; top: string; radius: string }[]
> = {
	Arc: [
		{ left: "14%", radius: "999px", size: "2.25rem", top: "58%" },
		{ left: "34%", radius: "999px", size: "2.75rem", top: "32%" },
		{ left: "54%", radius: "999px", size: "3.25rem", top: "16%" },
		{ left: "74%", radius: "999px", size: "2.5rem", top: "36%" },
	],
	Calm: [
		{ left: "16%", radius: "6px", size: "1.75rem", top: "42%" },
		{ left: "36%", radius: "6px", size: "2rem", top: "38%" },
		{ left: "56%", radius: "6px", size: "2.25rem", top: "40%" },
		{ left: "76%", radius: "6px", size: "1.85rem", top: "44%" },
	],
	Nova: [
		{ left: "44%", radius: "999px", size: "3rem", top: "14%" },
		{ left: "22%", radius: "999px", size: "2.25rem", top: "48%" },
		{ left: "66%", radius: "999px", size: "2.25rem", top: "48%" },
		{ left: "44%", radius: "999px", size: "2.75rem", top: "68%" },
	],
	Weave: [
		{ left: "20%", radius: "2px", size: "3.5rem", top: "22%" },
		{ left: "46%", radius: "2px", size: "4rem", top: "40%" },
		{ left: "32%", radius: "2px", size: "2.75rem", top: "62%" },
		{ left: "68%", radius: "2px", size: "3.25rem", top: "50%" },
	],
};

const PLAY_LAYOUT: Record<
	CompletionEffectTheme,
	readonly { left: string; size: string; top: string; radius: string }[]
> = {
	Arc: [
		{ left: "6%", radius: "999px", size: "4.5rem", top: "62%" },
		{ left: "22%", radius: "999px", size: "5.5rem", top: "28%" },
		{ left: "48%", radius: "999px", size: "7rem", top: "8%" },
		{ left: "72%", radius: "999px", size: "5rem", top: "24%" },
		{ left: "86%", radius: "999px", size: "4rem", top: "58%" },
		{ left: "38%", radius: "999px", size: "3.5rem", top: "72%" },
	],
	Calm: [
		{ left: "8%", radius: "8px", size: "3.25rem", top: "28%" },
		{ left: "28%", radius: "8px", size: "4rem", top: "18%" },
		{ left: "50%", radius: "8px", size: "4.5rem", top: "22%" },
		{ left: "72%", radius: "8px", size: "3.75rem", top: "16%" },
		{ left: "88%", radius: "8px", size: "3rem", top: "36%" },
		{ left: "40%", radius: "8px", size: "3.5rem", top: "68%" },
	],
	Nova: [
		{ left: "46%", radius: "999px", size: "8rem", top: "6%" },
		{ left: "12%", radius: "999px", size: "4.5rem", top: "38%" },
		{ left: "78%", radius: "999px", size: "5rem", top: "32%" },
		{ left: "30%", radius: "999px", size: "3.75rem", top: "68%" },
		{ left: "62%", radius: "999px", size: "4.25rem", top: "70%" },
		{ left: "48%", radius: "999px", size: "3rem", top: "48%" },
	],
	Weave: [
		{ left: "10%", radius: "3px", size: "7rem", top: "12%" },
		{ left: "38%", radius: "3px", size: "8rem", top: "28%" },
		{ left: "18%", radius: "3px", size: "5.5rem", top: "58%" },
		{ left: "62%", radius: "3px", size: "6.5rem", top: "16%" },
		{ left: "78%", radius: "3px", size: "7.5rem", top: "48%" },
		{ left: "48%", radius: "3px", size: "4.5rem", top: "72%" },
	],
};

const THEME_KEYFRAMES: Record<CompletionEffectTheme, string> = {
	Arc: `@keyframes completion-effect-motion {
		from { transform: translateX(-28px) translateY(18px) scale(0.85); opacity: 0.15; }
		to { transform: translateX(36px) translateY(-42px) scale(1.15); opacity: 0; }
	}`,
	Calm: `@keyframes completion-effect-motion {
		from { transform: translateY(12px); opacity: 0.45; }
		to { transform: translateY(-28px); opacity: 0; }
	}`,
	Nova: `@keyframes completion-effect-motion {
		from { transform: scale(0.35); opacity: 0.8; }
		to { transform: scale(1.65); opacity: 0; }
	}`,
	Weave: `@keyframes completion-effect-motion {
		from { transform: rotate(-14deg) translateX(-18px); opacity: 0.4; }
		to { transform: rotate(16deg) translateX(28px); opacity: 0; }
	}`,
};

function EffectMarks({
	motion,
	palette,
	surface,
	theme,
}: {
	motion: "static" | "playing";
	palette: string;
	surface: "sample" | "play";
	theme: CompletionEffectTheme;
}) {
	const swatches = paletteSwatches(theme, palette);
	const layout = surface === "play" ? PLAY_LAYOUT[theme] : SAMPLE_LAYOUT[theme];
	return (
		<>
			<span
				aria-hidden="true"
				className="absolute inset-0"
				style={{
					background: `radial-gradient(ellipse at 50% 40%, ${swatches[0]}66, transparent 70%)`,
					opacity: motion === "playing" ? 0.9 : 0.55,
				}}
			/>
			{layout.map((mark, index) => (
				<span
					className="absolute"
					key={`${surface}-${theme}-${mark.left}-${mark.top}`}
					style={{
						animation:
							motion === "playing"
								? `completion-effect-motion ${1.2 - (index % 4) * 0.1}s ease-out both`
								: "none",
						animationIterationCount: 1,
						background: swatches[index % swatches.length],
						borderRadius: mark.radius,
						height: mark.size,
						left: mark.left,
						opacity: motion === "static" ? 0.9 : undefined,
						top: mark.top,
						width: mark.size,
					}}
				/>
			))}
			<style>{THEME_KEYFRAMES[theme]}</style>
		</>
	);
}

export function EffectSample({
	lastFrame = false,
	motion,
	palette,
	theme,
}: {
	lastFrame?: boolean;
	motion: "static" | "playing";
	palette: string;
	theme: CompletionEffectTheme;
}) {
	return (
		<div
			aria-hidden="true"
			className="relative h-40 overflow-hidden rounded-none border border-border"
			data-frame={lastFrame ? "last" : "sample"}
			data-motion={motion}
			data-sample="completion-effect"
			data-theme={theme}
		>
			<EffectMarks
				motion={motion}
				palette={palette}
				surface={lastFrame ? "play" : "sample"}
				theme={theme}
			/>
		</div>
	);
}

export function EffectPlay({
	palette,
	theme,
}: {
	palette: string;
	theme: CompletionEffectTheme;
}) {
	return (
		<div
			aria-hidden="true"
			className="absolute inset-0 overflow-hidden"
			data-motion="playing"
			data-sample="completion-effect-play"
			data-theme={theme}
		>
			<EffectMarks
				motion="playing"
				palette={palette}
				surface="play"
				theme={theme}
			/>
		</div>
	);
}
