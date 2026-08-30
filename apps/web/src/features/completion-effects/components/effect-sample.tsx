import {
	type CompletionEffectTheme,
	paletteSwatches,
} from "@cantiara/auth/completion-effects-model";

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
	return (
		<div
			aria-hidden="true"
			className="relative h-24 overflow-hidden rounded-none border border-border"
			data-motion={motion}
			data-sample="completion-effect"
		>
			{swatches.map((color, index) => (
				<span
					className={
						motion === "playing"
							? "absolute size-6 rounded-full opacity-90"
							: "absolute size-6 rounded-full"
					}
					key={color}
					style={{
						animation:
							motion === "playing"
								? `completion-effect-preview ${1.2 - index * 0.12}s ease-out both`
								: "none",
						background: color,
						left: `${12 + index * 18}%`,
						top: `${30 + (index % 2) * 16}%`,
					}}
				/>
			))}
			<style>
				{`@keyframes completion-effect-preview {
					from { transform: translateY(12px) scale(0.7); opacity: 0.35; }
					to { transform: translateY(-8px) scale(1); opacity: 0; }
				}`}
			</style>
		</div>
	);
}
