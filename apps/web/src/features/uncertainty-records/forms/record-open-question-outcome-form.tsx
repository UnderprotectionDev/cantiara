import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import {
	OPEN_QUESTION_LIVES,
	UNCERTAINTY_COPY,
} from "./uncertainty-records-copy";

export default function RecordOpenQuestionOutcomeForm({
	baseRevision,
	life,
	onRecorded,
	openQuestionId,
	projectId,
}: {
	baseRevision: number;
	life: string;
	onRecorded?: () => void;
	openQuestionId: string;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [answer, setAnswer] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [evidenceSourceId, setEvidenceSourceId] = useState("");
	const [nextLife, setNextLife] = useState(life);
	const [rationale, setRationale] = useState("");
	const recordOutcome = useMutation(
		orpc.uncertaintyRecords.setOpenQuestionLife.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.uncertaintyRecords.listOpenQuestions.queryKey({
							input: { projectId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.uncertaintyRecords.getOpenQuestion.queryKey({
							input: { openQuestionId },
						}),
					});
					recordSave();
					onRecorded?.();
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
			if (
				nextLife !== UNCERTAINTY_COPY.open &&
				nextLife !== UNCERTAINTY_COPY.answered &&
				nextLife !== UNCERTAINTY_COPY.noLongerApplicable
			) {
				return;
			}
			setError(null);
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				recordOutcome.mutateAsync({
					baseRevision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						answer: answer.trim() === "" ? undefined : answer,
						evidence:
							nextLife === UNCERTAINTY_COPY.answered &&
							evidenceSourceId.trim() !== ""
								? {
										sourceId: evidenceSourceId.trim(),
										sourceKind: "Document",
									}
								: undefined,
						life: nextLife,
						openQuestionId,
						rationale: rationale.trim() === "" ? undefined : rationale,
					},
				})
			);
		},
		[
			answer,
			attemptOnlineWork,
			baseRevision,
			evidenceSourceId,
			markUnsaved,
			nextLife,
			openQuestionId,
			rationale,
			recordOutcome,
		]
	);
	const onLifeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setNextLife(event.target.value);
	}, []);
	const onAnswerChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setAnswer(event.target.value);
		},
		[]
	);
	const onRationaleChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setRationale(event.target.value);
		},
		[]
	);
	const onEvidenceChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setEvidenceSourceId(event.target.value);
		},
		[]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="open-question-outcome-life">
						{UNCERTAINTY_COPY.recordOutcome}
					</FieldLabel>
					<NativeSelect
						id="open-question-outcome-life"
						onChange={onLifeChange}
						value={nextLife}
					>
						{OPEN_QUESTION_LIVES.map((item) => (
							<NativeSelectOption key={item} value={item}>
								{item}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				{nextLife === UNCERTAINTY_COPY.answered ? (
					<>
						<Field>
							<FieldLabel htmlFor="open-question-answer">
								{UNCERTAINTY_COPY.answer}
							</FieldLabel>
							<Textarea
								id="open-question-answer"
								onChange={onAnswerChange}
								value={answer}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="open-question-rationale">
								{UNCERTAINTY_COPY.rationale}
							</FieldLabel>
							<Textarea
								id="open-question-rationale"
								onChange={onRationaleChange}
								value={rationale}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="open-question-evidence">
								{UNCERTAINTY_COPY.evidence}
							</FieldLabel>
							<Input
								id="open-question-evidence"
								onChange={onEvidenceChange}
								value={evidenceSourceId}
							/>
						</Field>
					</>
				) : null}
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{UNCERTAINTY_COPY.recordOutcome}</Button>
		</form>
	);
}
