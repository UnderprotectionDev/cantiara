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
	CONVERT_TARGET_KINDS,
	type ConvertTargetKind,
	RESEARCH_SESSIONS_COPY,
} from "@/features/research-sessions/forms/research-sessions-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

export default function ConvertResearchNoteForm({
	disabled,
	noteId,
	onConverted,
	projectId,
	revision,
	sessionId,
}: {
	disabled: boolean;
	noteId: string;
	onConverted?: () => void;
	projectId: string;
	revision: number;
	sessionId: string;
}) {
	const [recordKind, setRecordKind] = useState<ConvertTargetKind | "">("");
	const [title, setTitle] = useState("");
	const [error, setError] = useState<string | null>(null);
	const preview = useQuery({
		...orpc.researchSessions.previewConvert.queryOptions({
			input: {
				noteId,
				projectId,
				recordKind: recordKind || "Work",
				sessionId,
				title: title.trim() === "" ? undefined : title.trim(),
			},
		}),
		enabled: Boolean(recordKind) && !disabled,
	});
	const convert = useMutation(
		orpc.researchSessions.convert.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "rejected") {
					setError(outcome.reason);
					return;
				}
				setError(null);
				await queryClient.invalidateQueries({
					queryKey: orpc.researchSessions.get.queryKey({
						input: { sessionId },
					}),
				});
				onConverted?.();
			},
		})
	);
	const onKindChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setRecordKind(event.target.value as ConvertTargetKind | "");
	}, []);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onConfirm = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (
				!recordKind ||
				preview.data?.status !== "ok" ||
				preview.data.preview.recordKind !== recordKind
			) {
				return;
			}
			convert.mutate({
				baseRevision: revision,
				idempotencyKey: newIdempotencyKey(),
				payload: {
					noteId,
					previewAcknowledged: true,
					previewFingerprint: preview.data.preview.fingerprint,
					projectId,
					recordKind,
					sessionId,
					title: title.trim() === "" ? undefined : title.trim(),
				},
			});
		},
		[
			convert,
			noteId,
			preview.data,
			projectId,
			recordKind,
			revision,
			sessionId,
			title,
		]
	);
	const mapping =
		preview.data?.status === "ok" ? preview.data.preview : undefined;

	return (
		<form
			aria-label={RESEARCH_SESSIONS_COPY.convertToNewRecordAndBind}
			className="flex flex-col gap-2 border border-input p-2"
			onSubmit={onConfirm}
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={`research-convert-type-${noteId}`}>
						{RESEARCH_SESSIONS_COPY.targetType}
					</FieldLabel>
					<NativeSelect
						disabled={disabled}
						id={`research-convert-type-${noteId}`}
						onChange={onKindChange}
						value={recordKind}
					>
						<NativeSelectOption value="">
							{RESEARCH_SESSIONS_COPY.targetType}
						</NativeSelectOption>
						{CONVERT_TARGET_KINDS.map((kind) => (
							<NativeSelectOption key={kind} value={kind}>
								{kind}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor={`research-convert-title-${noteId}`}>
						{RESEARCH_SESSIONS_COPY.title}
					</FieldLabel>
					<Input
						disabled={disabled}
						id={`research-convert-title-${noteId}`}
						onChange={onTitleChange}
						value={title}
					/>
				</Field>
			</FieldGroup>
			{mapping ? (
				<div className="flex flex-col gap-1 text-sm">
					<p>
						{RESEARCH_SESSIONS_COPY.targetType}: {mapping.recordKind}
					</p>
					<p>
						{RESEARCH_SESSIONS_COPY.targetProject}: {mapping.projectId}
					</p>
					<p>
						{RESEARCH_SESSIONS_COPY.title}: {mapping.title}
					</p>
					<p>{mapping.origin}</p>
					<p>
						{mapping.versionPinnedEvidence} · {mapping.sessionRevision} ·{" "}
						{mapping.textRange.start}–{mapping.textRange.end}
					</p>
				</div>
			) : null}
			<Button
				disabled={disabled || !recordKind || mapping === undefined}
				type="submit"
			>
				{RESEARCH_SESSIONS_COPY.convertToNewRecordAndBind}
			</Button>
			{error ? <p role="alert">{error}</p> : null}
		</form>
	);
}
