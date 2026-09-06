import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { eyedropScreenColor } from "./moodboard-eyedrop";
import { MOODBOARDS_COPY } from "./moodboards-copy";

const COLOR_KINDS = [
	MOODBOARDS_COPY.picker,
	MOODBOARDS_COPY.eyedrop,
	MOODBOARDS_COPY.hex,
	MOODBOARDS_COPY.rgb,
	MOODBOARDS_COPY.hsl,
] as const;

type ColorKind = (typeof COLOR_KINDS)[number];

export default function AddColorSwatchForm({
	moodboardId,
	paletteGroups,
	projectId,
	visuals,
}: {
	moodboardId: string;
	paletteGroups: readonly { id: string; title: string }[];
	projectId: string;
	visuals: readonly { caption: string; id: string; origin: { kind: string } }[];
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [b, setB] = useState("0");
	const [error, setError] = useState<string | null>(null);
	const [g, setG] = useState("0");
	const [h, setH] = useState("0");
	const [hex, setHex] = useState("#336699");
	const [kind, setKind] = useState<ColorKind>(MOODBOARDS_COPY.picker);
	const [l, setL] = useState("50");
	const [note, setNote] = useState("");
	const [paletteGroupId, setPaletteGroupId] = useState("");
	const [r, setR] = useState("51");
	const [s, setS] = useState("50");
	const [visualId, setVisualId] = useState("");
	const addSwatch = useMutation(
		orpc.moodboards.addColorSwatch.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.moodboards.get.queryKey({
							input: { moodboardId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.moodboards.list.queryKey({
							input: { projectId },
						}),
					});
					recordSave();
					setError(null);
					setNote("");
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			markUnsaved();
			const color = colorPayload({
				b,
				g,
				h,
				hex,
				kind,
				l,
				r,
				s,
				visualId,
			});
			attemptOnlineWork("record-create", () =>
				addSwatch.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						color,
						moodboardId,
						note: note.length > 0 ? note : undefined,
						paletteGroupId:
							paletteGroupId.length > 0 ? paletteGroupId : undefined,
					},
				})
			);
		},
		[
			addSwatch,
			attemptOnlineWork,
			b,
			g,
			h,
			hex,
			kind,
			l,
			markUnsaved,
			moodboardId,
			note,
			paletteGroupId,
			r,
			s,
			visualId,
		]
	);
	const onKindChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		if (COLOR_KINDS.includes(event.target.value as ColorKind)) {
			setKind(event.target.value as ColorKind);
		}
	}, []);
	const onHexChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setHex(event.target.value);
	}, []);
	const onRChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setR(event.target.value);
	}, []);
	const onGChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setG(event.target.value);
	}, []);
	const onBChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setB(event.target.value);
	}, []);
	const onHChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setH(event.target.value);
	}, []);
	const onSChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setS(event.target.value);
	}, []);
	const onLChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setL(event.target.value);
	}, []);
	const onNoteChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setNote(event.target.value);
	}, []);
	const onPaletteChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setPaletteGroupId(event.target.value);
		},
		[]
	);
	const onVisualChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setVisualId(event.target.value);
		},
		[]
	);
	const onEyedrop = useCallback(async () => {
		const sampled = await eyedropScreenColor();
		if (sampled) {
			setHex(sampled);
		}
	}, []);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="moodboard-color-kind">
						{MOODBOARDS_COPY.colorSwatch}
					</FieldLabel>
					<select
						id="moodboard-color-kind"
						onChange={onKindChange}
						value={kind}
					>
						{COLOR_KINDS.map((item) => (
							<option key={item} value={item}>
								{item}
							</option>
						))}
					</select>
				</Field>
				{kind === MOODBOARDS_COPY.eyedrop ? (
					<Field>
						<FieldLabel htmlFor="moodboard-eyedrop-visual">
							{MOODBOARDS_COPY.eyedrop}
						</FieldLabel>
						<select
							id="moodboard-eyedrop-visual"
							onChange={onVisualChange}
							required
							value={visualId}
						>
							<option value="">{MOODBOARDS_COPY.eyedrop}</option>
							{visuals.map((visual) => (
								<option key={visual.id} value={visual.id}>
									{visual.caption.length > 0
										? visual.caption
										: visual.origin.kind}
								</option>
							))}
						</select>
					</Field>
				) : null}
				{kind === MOODBOARDS_COPY.rgb ? (
					<>
						<ChannelField
							id="moodboard-color-r"
							label={`${MOODBOARDS_COPY.rgb} R`}
							max={255}
							onChange={onRChange}
							value={r}
						/>
						<ChannelField
							id="moodboard-color-g"
							label={`${MOODBOARDS_COPY.rgb} G`}
							max={255}
							onChange={onGChange}
							value={g}
						/>
						<ChannelField
							id="moodboard-color-b"
							label={`${MOODBOARDS_COPY.rgb} B`}
							max={255}
							onChange={onBChange}
							value={b}
						/>
					</>
				) : null}
				{kind === MOODBOARDS_COPY.hsl ? (
					<>
						<ChannelField
							id="moodboard-color-h"
							label={`${MOODBOARDS_COPY.hsl} H`}
							max={360}
							onChange={onHChange}
							value={h}
						/>
						<ChannelField
							id="moodboard-color-s"
							label={`${MOODBOARDS_COPY.hsl} S`}
							max={100}
							onChange={onSChange}
							value={s}
						/>
						<ChannelField
							id="moodboard-color-l"
							label={`${MOODBOARDS_COPY.hsl} L`}
							max={100}
							onChange={onLChange}
							value={l}
						/>
					</>
				) : null}
				{kind === MOODBOARDS_COPY.picker ||
				kind === MOODBOARDS_COPY.hex ||
				kind === MOODBOARDS_COPY.eyedrop ? (
					<Field>
						<FieldLabel htmlFor="moodboard-color-hex">
							{kind === MOODBOARDS_COPY.picker
								? MOODBOARDS_COPY.picker
								: MOODBOARDS_COPY.hex}
						</FieldLabel>
						<Input
							id="moodboard-color-hex"
							onChange={onHexChange}
							required
							type={kind === MOODBOARDS_COPY.picker ? "color" : "text"}
							value={hex}
						/>
					</Field>
				) : null}
				{kind === MOODBOARDS_COPY.eyedrop ? (
					<Button onClick={onEyedrop} type="button">
						{MOODBOARDS_COPY.eyedrop}
					</Button>
				) : null}
				<Field>
					<FieldLabel htmlFor="moodboard-swatch-palette">
						{MOODBOARDS_COPY.paletteGroup}
					</FieldLabel>
					<select
						id="moodboard-swatch-palette"
						onChange={onPaletteChange}
						value={paletteGroupId}
					>
						<option value="">{MOODBOARDS_COPY.colorSwatch}</option>
						{paletteGroups.map((group) => (
							<option key={group.id} value={group.id}>
								{group.title}
							</option>
						))}
					</select>
				</Field>
				<Field>
					<FieldLabel htmlFor="moodboard-swatch-note">
						{MOODBOARDS_COPY.note}
					</FieldLabel>
					<Input
						id="moodboard-swatch-note"
						maxLength={280}
						onChange={onNoteChange}
						value={note}
					/>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{MOODBOARDS_COPY.addColorSwatch}</Button>
		</form>
	);
}

function ChannelField({
	id,
	label,
	max,
	onChange,
	value,
}: {
	id: string;
	label: string;
	max: number;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	value: string;
}) {
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input
				id={id}
				max={max}
				min={0}
				onChange={onChange}
				required
				type="number"
				value={value}
			/>
		</Field>
	);
}

function colorPayload(input: {
	b: string;
	g: string;
	h: string;
	hex: string;
	kind: ColorKind;
	l: string;
	r: string;
	s: string;
	visualId: string;
}) {
	if (input.kind === MOODBOARDS_COPY.rgb) {
		return {
			b: Number(input.b),
			g: Number(input.g),
			kind: MOODBOARDS_COPY.rgb,
			r: Number(input.r),
		};
	}
	if (input.kind === MOODBOARDS_COPY.hsl) {
		return {
			h: Number(input.h),
			kind: MOODBOARDS_COPY.hsl,
			l: Number(input.l),
			s: Number(input.s),
		};
	}
	if (input.kind === MOODBOARDS_COPY.eyedrop) {
		return {
			hex: input.hex,
			kind: MOODBOARDS_COPY.eyedrop,
			visualId: input.visualId,
		};
	}
	if (input.kind === MOODBOARDS_COPY.picker) {
		return { hex: input.hex, kind: MOODBOARDS_COPY.picker };
	}
	return { hex: input.hex, kind: MOODBOARDS_COPY.hex };
}
