import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { orpc } from "@/utils/orpc";

import { MOODBOARDS_COPY } from "./moodboards-copy";

export default function MoodboardSnapshotForm({
	moodboardId,
	visuals,
}: {
	moodboardId: string;
	visuals: readonly { id: string; label: string }[];
}) {
	const [error, setError] = useState<string | null>(null);
	const [format, setFormat] = useState<
		typeof MOODBOARDS_COPY.png | typeof MOODBOARDS_COPY.pdf
	>(MOODBOARDS_COPY.png);
	const [preview, setPreview] = useState<{
		applied: readonly {
			crop: { height: number; left: number; top: number; width: number } | null;
			rotation: number;
			visualId: string;
		}[];
		noLiveSourceLinks: string;
		viewMoment: string;
	} | null>(null);
	const [selected, setSelected] = useState<Record<string, boolean>>({});
	const previewSnapshot = useMutation(
		orpc.moodboards.previewSnapshot.mutationOptions({
			onSuccess: (outcome) => {
				if (outcome.status === "ok") {
					setPreview({
						applied: outcome.snapshot.preview.applied,
						noLiveSourceLinks: outcome.snapshot.preview.noLiveSourceLinks,
						viewMoment: outcome.snapshot.preview.viewMoment,
					});
					setError(null);
					return;
				}
				setError(outcome.reason);
			},
		})
	);
	const exportSnapshot = useMutation(
		orpc.moodboards.exportSnapshot.mutationOptions({
			onSuccess: (outcome) => {
				if (outcome.status !== "ok") {
					setError(outcome.reason);
					return;
				}
				setError(null);
				for (const file of outcome.snapshot.files) {
					downloadBase64(file.filename, file.mimeType, file.bytesBase64);
				}
			},
		})
	);
	const visualIds = visuals
		.filter((visual) => selected[visual.id])
		.map((visual) => visual.id);
	const onPreview = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			previewSnapshot.mutate({
				format,
				moodboardId,
				visualIds,
			});
		},
		[format, moodboardId, previewSnapshot, visualIds]
	);
	const onExport = useCallback(() => {
		setError(null);
		exportSnapshot.mutate({
			format,
			moodboardId,
			visualIds,
		});
	}, [exportSnapshot, format, moodboardId, visualIds]);
	const onFormat = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		if (
			event.target.value === MOODBOARDS_COPY.png ||
			event.target.value === MOODBOARDS_COPY.pdf
		) {
			setFormat(event.target.value);
		}
	}, []);
	const onToggle = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		const { checked, value: id } = event.target;
		setSelected((current) => ({ ...current, [id]: checked }));
	}, []);

	return (
		<form className="flex flex-col gap-3" onSubmit={onPreview}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="moodboard-snapshot-format">
						{MOODBOARDS_COPY.snapshot}
					</FieldLabel>
					<select
						id="moodboard-snapshot-format"
						onChange={onFormat}
						value={format}
					>
						<option value={MOODBOARDS_COPY.png}>{MOODBOARDS_COPY.png}</option>
						<option value={MOODBOARDS_COPY.pdf}>{MOODBOARDS_COPY.pdf}</option>
					</select>
				</Field>
				{visuals.map((visual) => (
					<Field key={visual.id}>
						<FieldLabel htmlFor={`moodboard-snapshot-${visual.id}`}>
							{visual.label}
						</FieldLabel>
						<input
							checked={Boolean(selected[visual.id])}
							id={`moodboard-snapshot-${visual.id}`}
							onChange={onToggle}
							type="checkbox"
							value={visual.id}
						/>
					</Field>
				))}
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			{preview ? (
				<div className="flex flex-col gap-1 text-sm">
					<p>{preview.noLiveSourceLinks}</p>
					<p>{preview.viewMoment}</p>
					<ul>
						{preview.applied.map((item) => (
							<li key={item.visualId}>
								{MOODBOARDS_COPY.crop} · {item.rotation} ·{" "}
								{item.crop
									? `${item.crop.left}, ${item.crop.top}, ${item.crop.width}, ${item.crop.height}`
									: MOODBOARDS_COPY.preview}
							</li>
						))}
					</ul>
				</div>
			) : null}
			<div className="flex flex-wrap gap-2">
				<Button type="submit">{MOODBOARDS_COPY.preview}</Button>
				<Button onClick={onExport} type="button">
					{MOODBOARDS_COPY.snapshot}
				</Button>
			</div>
		</form>
	);
}

function downloadBase64(
	filename: string,
	mimeType: string,
	bytesBase64: string
) {
	const binary = atob(bytesBase64);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
	const link = document.createElement("a");
	link.download = filename;
	link.href = url;
	link.click();
	URL.revokeObjectURL(url);
}
