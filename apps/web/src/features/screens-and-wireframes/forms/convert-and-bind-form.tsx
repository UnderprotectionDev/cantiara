import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import {
	CONVERT_RECORD_KINDS,
	type ConvertRecordKind,
	SCREENS_COPY,
} from "@/features/screens-and-wireframes/forms/screens-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

export default function ConvertAndBindForm({
	nodeId,
	onConverted,
	projectId,
	screenId,
	versionNumber,
}: {
	nodeId: string;
	onConverted: () => void;
	projectId: string;
	screenId: string;
	versionNumber: number;
}) {
	const [recordKind, setRecordKind] = useState<ConvertRecordKind | "">("");
	const [title, setTitle] = useState("");
	const [error, setError] = useState<string | null>(null);
	const preview = useQuery({
		...orpc.screensAndWireframes.previewConvertAndBind.queryOptions({
			input: {
				nodeId,
				projectId,
				recordKind: recordKind || "Work",
				screenId,
				title: title.trim() === "" ? undefined : title.trim(),
				versionNumber,
			},
		}),
		enabled: Boolean(recordKind),
	});
	const convert = useMutation(
		orpc.screensAndWireframes.convertAndBind.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "rejected") {
					setError(outcome.reason);
					return;
				}
				setError(null);
				await queryClient.invalidateQueries({
					queryKey: orpc.screensAndWireframes.get.queryKey({
						input: { screenId },
					}),
				});
				onConverted();
			},
		})
	);
	const onKindChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setRecordKind(event.target.value as ConvertRecordKind | "");
	}, []);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onConfirm = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (preview.data?.status !== "ok" || !recordKind) {
				return;
			}
			convert.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: {
					nodeId,
					previewFingerprint: preview.data.preview.fingerprint,
					projectId,
					recordKind,
					screenId,
					title: title.trim() === "" ? undefined : title.trim(),
					versionNumber,
				},
				previewAcknowledged: true,
			});
		},
		[
			convert,
			nodeId,
			preview.data,
			projectId,
			recordKind,
			screenId,
			title,
			versionNumber,
		]
	);
	const mapping =
		preview.data?.status === "ok" ? preview.data.preview : undefined;

	return (
		<form
			aria-label={SCREENS_COPY.convertAndBind}
			className="flex flex-col gap-2 border border-input p-2"
			onSubmit={onConfirm}
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={`convert-kind-${nodeId}`}>
						{SCREENS_COPY.convertAndBind}
					</FieldLabel>
					<NativeSelect
						id={`convert-kind-${nodeId}`}
						onChange={onKindChange}
						value={recordKind}
					>
						<NativeSelectOption value="">
							{SCREENS_COPY.convertAndBind}
						</NativeSelectOption>
						{CONVERT_RECORD_KINDS.map((kind) => (
							<NativeSelectOption key={kind} value={kind}>
								{kind}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor={`convert-title-${nodeId}`}>
						{SCREENS_COPY.title}
					</FieldLabel>
					<Input
						id={`convert-title-${nodeId}`}
						onChange={onTitleChange}
						value={title}
					/>
				</Field>
			</FieldGroup>
			{mapping ? (
				<div className="flex flex-col gap-1 text-sm">
					<p>
						{SCREENS_COPY.project}: {mapping.projectId}
					</p>
					<p>
						{SCREENS_COPY.title}: {mapping.title}
					</p>
					<p>
						{SCREENS_COPY.text}: {mapping.body}
					</p>
					<p>
						{SCREENS_COPY.origin}: {mapping.origin}
					</p>
					<p>
						{SCREENS_COPY.originLocation}:{" "}
						{mapping.originLocation.missing
							? SCREENS_COPY.sourceItemIsGone
							: `${mapping.originLocation.ownerId} · ${mapping.originLocation.componentId} · ${mapping.originLocation.sourceVersion}`}
					</p>
				</div>
			) : null}
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{SCREENS_COPY.confirm}</Button>
		</form>
	);
}
