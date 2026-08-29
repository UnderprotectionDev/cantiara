import { Button } from "@cantiara/ui/components/button";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useCallback, useState } from "react";

import {
	CUSTOM_FIELD_COPY,
	type CustomFieldStoredValue,
} from "@/features/custom-fields/forms/custom-fields-copy";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { workTemplateMutationError } from "./work-template-mutation-error";
import { WORK_TEMPLATE_COPY } from "./work-templates-copy";

export default function DuplicateWorkForm({
	onDuplicated,
	projectId,
	workId,
}: {
	onDuplicated?: (workId: string) => void;
	projectId: string;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const preview = useQuery(
		orpc.workTemplates.previewDuplicate.queryOptions({
			input: { workId },
		})
	);
	const duplicate = useMutation(
		orpc.workTemplates.duplicate.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, workId);
					await invalidateWork(projectId, outcome.work.id);
					recordSave();
					setError(null);
					onDuplicated?.(outcome.work.id);
					return;
				}
				const message = workTemplateMutationError(outcome);
				if (message) {
					setError(message);
				}
			},
		})
	);
	const form = useForm({
		defaultValues: {},
		onSubmit: async () => {
			setError(null);
			const result = attemptOnlineWork("record-create", () =>
				duplicate.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: { previewAcknowledged: true, workId },
				})
			);
			if (result.status === "refused") {
				return;
			}
			await result.value;
		},
	});
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			form.handleSubmit().catch(() => undefined);
		},
		[form, markUnsaved]
	);
	const previewData =
		preview.data?.status === "ok" ? preview.data.preview : null;

	return (
		<form
			aria-label={WORK_TEMPLATE_COPY.duplicateWork}
			className="flex flex-col gap-3"
			onSubmit={onSubmit}
		>
			<h3 className="font-medium text-sm">
				{WORK_TEMPLATE_COPY.duplicateWork}
			</h3>
			{previewData ? (
				<section aria-label={WORK_TEMPLATE_COPY.fieldsToCopy}>
					<h4 className="text-muted-foreground text-sm">
						{WORK_TEMPLATE_COPY.fieldsToCopy}
					</h4>
					<ul className="mt-2 flex flex-col gap-1 text-sm">
						<li>
							{previewData.copy.title}: {previewData.copyableFields.title}
						</li>
						<li>
							{previewData.copy.type}: {previewData.copyableFields.type}
						</li>
						<li>
							{previewData.copy.description}:{" "}
							{previewData.copyableFields.description ?? "—"}
						</li>
						<li>
							{previewData.copy.checklist}:{" "}
							{previewData.copyableFields.lightChecklist.length === 0
								? "—"
								: previewData.copyableFields.lightChecklist
										.map((item) => item.title)
										.join(", ")}
						</li>
						{previewData.copyableFields.customFields.map((field) => (
							<li key={field.definitionId}>
								{field.name}: {displayFieldValue(field.value)}
							</li>
						))}
					</ul>
				</section>
			) : null}
			<Button
				disabled={duplicate.isPending || previewData === null}
				type="submit"
			>
				{WORK_TEMPLATE_COPY.duplicateWork}
			</Button>
			{error ? <p role="alert">{error}</p> : null}
		</form>
	);
}

function displayFieldValue(value: CustomFieldStoredValue): string {
	if (value.kind === "text") {
		return value.text;
	}
	if (value.kind === "number") {
		return String(value.number);
	}
	if (value.kind === "boolean") {
		return value.boolean
			? CUSTOM_FIELD_COPY.booleanTrue
			: CUSTOM_FIELD_COPY.booleanFalse;
	}
	if (value.kind === "single-select") {
		return value.option;
	}
	if (value.kind === "multi-select") {
		return value.options.join(", ");
	}
	return CUSTOM_FIELD_COPY.notEvaluated;
}
