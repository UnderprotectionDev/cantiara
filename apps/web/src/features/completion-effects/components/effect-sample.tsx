import {
	type CompletionEffectTheme,
	paletteSwatches,
} from "@cantiara/auth/completion-effects-model";

const THEME_LAYOUT: Record<
	CompletionEffectTheme,
	readonly { left: string; top: string; radius: string }[]
> = {
	Arc: [
		{ left: "18%", radius: "999px", top: "62%" },
		{ left: "36%", radius: "999px", top: "38%" },
		{ left: "54%", radius: "999px", top: "22%" },
		{ left: "72%", radius: "999px", top: "38%" },
	],
	Calm: [
		{ left: "22%", radius: "4px", top: "42%" },
		{ left: "40%", radius: "4px", top: "42%" },
		{ left: "58%", radius: "4px", top: "42%" },
		{ left: "76%", radius: "4px", top: "42%" },
	],
	Nova: [
		{ left: "46%", radius: "999px", top: "22%" },
		{ left: "30%", radius: "999px", top: "50%" },
		{ left: "62%", radius: "999px", top: "50%" },
		{ left: "46%", radius: "999px", top: "68%" },
	],
	Weave: [
		{ left: "28%", radius: "2px", top: "28%" },
		{ left: "48%", radius: "2px", top: "44%" },
		{ left: "36%", radius: "2px", top: "60%" },
		{ left: "64%", radius: "2px", top: "52%" },
	],
};

const THEME_KEYFRAMES: Record<CompletionEffectTheme, string> = {
	Arc: `@keyframes completion-effect-preview {
		from { transform: translateX(-10px) translateY(8px); opacity: 0.4; }
		to { transform: translateX(10px) translateY(-10px); opacity: 0; }
	}`,
	Calm: `@keyframes completion-effect-preview {
		from { transform: translateY(4px); opacity: 0.55; }
		to { transform: translateY(-4px); opacity: 0.15; }
	}`,
	Nova: `@keyframes completion-effect-preview {
		from { transform: scale(0.4); opacity: 0.7; }
		to { transform: scale(1.4); opacity: 0; }
	}`,
	Weave: `@keyframes completion-effect-preview {
		from { transform: rotate(-8deg) translateX(-6px); opacity: 0.5; }
		to { transform: rotate(8deg) translateX(6px); opacity: 0; }
	}`,
};

export function EffectSample({
	motion,
	palette,
	theme,
}: {
	motion: "static" | "playing";
	palette: string;
	theme: CompletionEffectTheme;
}) {
	const swatches = paletteSwatches(theme, palette);
	const layout = THEME_LAYOUT[theme];
	return (
		<div
			aria-hidden="true"
			className="relative h-24 overflow-hidden rounded-none border border-border"
			data-motion={motion}
			data-sample="completion-effect"
			data-theme={theme}
		>
			{swatches.map((color, index) => (
				<span
					className="absolute size-5"
					key={`${theme}-${color}`}
					style={{
						animation:
							motion === "playing"
								? `completion-effect-preview ${1.2 - index * 0.12}s ease-out both`
								: "none",
						background: color,
						borderRadius: layout[index]?.radius,
						left: layout[index]?.left,
						top: layout[index]?.top,
					}}
				/>
			))}
			<style>{THEME_KEYFRAMES[theme]}</style>
		</div>
	);
}
