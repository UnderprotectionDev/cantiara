import { COMPLETION_EFFECTS_COPY } from "@cantiara/auth/completion-effects-copy";
import {
	COMPLETION_EFFECT_THEMES,
	type CompletionEffectPreference,
	catalogBrowseMotion,
	PREVIEW_MOTION_MS,
	paletteSwatches,
	palettesForTheme,
	previewMotion,
	themeForPaletteChange,
} from "@cantiara/auth/completion-effects-model";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Switch } from "@cantiara/ui/components/switch";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EffectSample } from "@/features/completion-effects/components/effect-sample";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { orpc, queryClient } from "@/utils/orpc";

export default function CompletionEffectsForm({
	preference,
}: {
	preference: CompletionEffectPreference;
}) {
	const { attemptOnlineWork, recordSave } = useClientShell();
	const [previewStartedAtMs, setPreviewStartedAtMs] = useState<number | null>(
		null
	);
	const [nowMs, setNowMs] = useState(() => Date.now());
	const save = useMutation(
		orpc.completionEffects.save.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.completionEffects.get.queryKey(),
				});
				recordSave();
				toast.success(COMPLETION_EFFECTS_COPY.saved);
			},
		})
	);
	const persist = useCallback(
		(next: CompletionEffectPreference) => {
			attemptOnlineWork("record-create", () => {
				save.mutate(next);
			});
		},
		[attemptOnlineWork, save]
	);
	const motion =
		previewMotion(previewStartedAtMs, nowMs) === "playing"
			? "playing"
			: catalogBrowseMotion();

	useEffect(() => {
		if (previewStartedAtMs === null) {
			return;
		}
		const frame = window.setInterval(() => {
			setNowMs(Date.now());
		}, 50);
		const stop = window.setTimeout(() => {
			setPreviewStartedAtMs(null);
		}, PREVIEW_MOTION_MS);
		return () => {
			window.clearInterval(frame);
			window.clearTimeout(stop);
		};
	}, [previewStartedAtMs]);

	const onEnable = useCallback(
		(enabled: boolean) => {
			persist({ ...preference, enabled });
		},
		[persist, preference]
	);
	const onTheme = useCallback(
		(theme: (typeof COMPLETION_EFFECT_THEMES)[number]) => {
			persist({
				...preference,
				...themeForPaletteChange(preference.theme, preference.palette, theme),
			});
			setPreviewStartedAtMs(null);
		},
		[persist, preference]
	);
	const onPalette = useCallback(
		(palette: string) => {
			persist({ ...preference, palette });
			setPreviewStartedAtMs(null);
		},
		[persist, preference]
	);
	const onPreview = useCallback(() => {
		setNowMs(Date.now());
		setPreviewStartedAtMs(Date.now());
	}, []);

	return (
		<div className="flex flex-col gap-6">
			<p className="text-muted-foreground text-sm">
				{COMPLETION_EFFECTS_COPY.experimental}
			</p>
			<Field orientation="horizontal">
				<Switch
					aria-label={COMPLETION_EFFECTS_COPY.enable}
					checked={preference.enabled}
					id="completion-effects-enable"
					onCheckedChange={onEnable}
				/>
				<FieldLabel htmlFor="completion-effects-enable">
					{COMPLETION_EFFECTS_COPY.enable}
				</FieldLabel>
			</Field>
			<FieldGroup>
				<fieldset className="flex flex-col gap-3">
					<legend className="font-medium text-sm">
						{COMPLETION_EFFECTS_COPY.theme}
					</legend>
					<div className="grid gap-2 sm:grid-cols-2">
						{COMPLETION_EFFECT_THEMES.map((theme) => (
							<CatalogChoice
								key={theme}
								label={theme}
								onSelect={onTheme}
								selected={preference.theme === theme}
								value={theme}
							/>
						))}
					</div>
				</fieldset>
				<fieldset className="flex flex-col gap-3">
					<legend className="font-medium text-sm">
						{COMPLETION_EFFECTS_COPY.palette}
					</legend>
					<div className="grid gap-2 sm:grid-cols-2">
						{palettesForTheme(preference.theme).map((palette) => (
							<CatalogChoice
								key={palette}
								label={palette}
								onSelect={onPalette}
								selected={preference.palette === palette}
								swatch={paletteSwatches(preference.theme, palette)[1]}
								value={palette}
							/>
						))}
					</div>
				</fieldset>
			</FieldGroup>
			<EffectSample
				motion={motion}
				palette={preference.palette}
				theme={preference.theme}
			/>
			{save.isError ? (
				<p id="completion-effects-save-error" role="alert" tabIndex={-1}>
					{COMPLETION_EFFECTS_COPY.unavailable}
				</p>
			) : null}
			<Button
				aria-describedby={
					save.isError ? "completion-effects-save-error" : undefined
				}
				disabled={save.isPending}
				onClick={onPreview}
				type="button"
			>
				{COMPLETION_EFFECTS_COPY.preview}
			</Button>
		</div>
	);
}

function CatalogChoice<T extends string>({
	label,
	onSelect,
	selected,
	swatch,
	value,
}: {
	label: string;
	onSelect: (value: T) => void;
	selected: boolean;
	swatch?: string;
	value: T;
}) {
	const onClick = useCallback(() => {
		onSelect(value);
	}, [onSelect, value]);
	return (
		<Button
			aria-pressed={selected}
			onClick={onClick}
			type="button"
			variant={selected ? "default" : "outline"}
		>
			<span className="flex items-center gap-2">
				{swatch ? (
					<span
						aria-hidden="true"
						className="size-3 rounded-full border border-border"
						style={{ background: swatch }}
					/>
				) : null}
				{label}
			</span>
		</Button>
	);
}
