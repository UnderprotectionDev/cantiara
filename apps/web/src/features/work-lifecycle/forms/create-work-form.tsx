import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { CustomFieldValueFields } from "@/features/custom-fields/forms/custom-field-value-control";
import { invalidateCustomFieldValues } from "@/features/custom-fields/forms/custom-field-values-editor";
import type { CustomFieldStoredValue } from "@/features/custom-fields/forms/custom-fields-copy";
import { writeCustomFieldValues } from "@/features/custom-fields/forms/write-custom-field-values";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import WorkDraftForm from "@/features/work-drafts/forms/work-draft-form";
import {
	createWorkFormSeedFromListedDrafts,
	type WorkDraftFormValues,
} from "@/features/work-drafts/forms/work-draft-form-state";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { invalidateWork } from "./invalidate-work";
import { WORK_LIFECYCLE_COPY } from "./work-lifecycle-copy";

export default function CreateWorkForm({
	onCreated,
	projectId,
}: {
	onCreated?: (workId: string) => void;
	projectId: string;
}) {
	const drafts = useQuery(orpc.workDrafts.list.queryOptions());
	const seedCapture = useRef<{
		draftId: string | null;
		form: WorkDraftFormValues | undefined;
		lastSuccessfulSaveAt: Date | string | null;
		projectId: string;
	} | null>(null);
	if (!drafts.isPending && seedCapture.current?.projectId !== projectId) {
		seedCapture.current = {
			...createWorkFormSeedFromListedDrafts(drafts.data ?? [], projectId),
			projectId,
		};
	}
	const seed = seedCapture.current;
	if (!seed || seed.projectId !== projectId) {
		return <div className="flex flex-col gap-3" />;
	}

	return (
		<HydratedCreateWorkForm
			initialDraftId={seed.draftId}
			initialForm={seed.form}
			key={projectId}
			lastSuccessfulSaveAt={seed.lastSuccessfulSaveAt}
			onCreated={onCreated}
			projectId={projectId}
		/>
	);
}

function HydratedCreateWorkForm({
	initialDraftId,
	initialForm,
	lastSuccessfulSaveAt,
	onCreated,
	projectId,
}: {
	initialDraftId: string | null;
	initialForm: WorkDraftFormValues | undefined;
	lastSuccessfulSaveAt: Date | string | null;
	onCreated?: (workId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [draftId, setDraftId] = useState<string | null>(initialDraftId);
	const [consumed, setConsumed] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [values, setValues] = useState<Record<string, CustomFieldStoredValue>>(
		{}
	);
	const fields = useQuery(
		orpc.customFields.surface.queryOptions({
			input: { projectId, recordType: "Work" },
		})
	);
	const setCustomValue = useMutation(
		orpc.customFields.setValue.mutationOptions()
	);
	const create = useMutation(
		orpc.workDrafts.finalize.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "created") {
					await invalidateWork(projectId, outcome.work.id);
					await queryClient.invalidateQueries({
						queryKey: orpc.projectShell.get.queryKey({
							input: { projectId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.workDrafts.list.queryKey(),
					});
					onCreated?.(outcome.work.id);
					setConsumed(true);
					setDraftId(null);
					recordSave();
					setError(null);
					return;
				}
				if (outcome.status === "consumed") {
					setConsumed(true);
					return;
				}
				if (outcome.status === "conflict" || outcome.status === "rejected") {
					setError(
						outcome.status === "conflict"
							? "Conflict"
							: WORK_LIFECYCLE_COPY.title
					);
				}
			},
		})
	);
	const onCreate = useCallback(
		async (
			formValues: WorkDraftFormValues,
			persistedDraftId: string | null
		) => {
			setError(null);
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					draftId: persistedDraftId ?? undefined,
					form: {
						customFieldValues: formValues.customFieldValues,
						projectId,
						title: formValues.title,
						type: formValues.type,
					},
					idempotencyKey: newIdempotencyKey(),
				})
			);
			if (result.status === "refused") {
				return;
			}
			const outcome = await result.value;
			if (outcome.status === "created") {
				const message = await writeCustomFieldValues({
					attempt: attemptOnlineWork,
					fields: fields.data ?? [],
					recordId: outcome.work.id,
					recordType: "Work",
					setValue: setCustomValue.mutateAsync,
					values,
				});
				if (message) {
					setError(message);
					return;
				}
				await invalidateCustomFieldValues(projectId, "Work", outcome.work.id);
				setValues({});
			}
		},
		[
			attemptOnlineWork,
			create,
			fields.data,
			markUnsaved,
			projectId,
			setCustomValue,
			values,
		]
	);
	const onCustomFieldValueChange = useCallback(
		(definitionId: string, value: CustomFieldStoredValue) => {
			setValues((current) => ({
				...current,
				[definitionId]: value,
			}));
		},
		[]
	);

	return (
		<div className="flex flex-col gap-3">
			{error ? (
				<p id="create-work-error" role="alert" tabIndex={-1}>
					{error}
				</p>
			) : null}
			<WorkDraftForm
				createDisabled={create.isPending || consumed}
				draftId={draftId}
				initialForm={initialForm}
				lastSuccessfulSaveAt={lastSuccessfulSaveAt}
				lockProjectId={projectId}
				onCreate={onCreate}
				onDraftId={setDraftId}
			/>
			{fields.data && fields.data.length > 0 ? (
				<CustomFieldValueFields
					fields={fields.data}
					onValueChange={onCustomFieldValueChange}
					values={values}
				/>
			) : null}
		</div>
	);
}
