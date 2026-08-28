import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { orpc, queryClient } from "@/utils/orpc";

import { CustomFieldValueFields } from "../forms/custom-field-value-control";
import CustomFieldValuesEditor, {
	invalidateCustomFieldValues,
} from "../forms/custom-field-values-editor";
import {
	CUSTOM_FIELD_COPY,
	type CustomFieldStoredValue,
} from "../forms/custom-fields-copy";
import { writeCustomFieldValues } from "../forms/write-custom-field-values";

export default function BoundRecordValuesSurface({
	projectId,
	recordType,
}: {
	projectId: string;
	recordType: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [draftId, setDraftId] = useState(() => crypto.randomUUID());
	const [values, setValues] = useState<Record<string, CustomFieldStoredValue>>(
		{}
	);
	const createSurface = useQuery(
		orpc.customFields.surface.queryOptions({
			input: { projectId, recordType },
		})
	);
	const records = useQuery(
		orpc.customFields.listRecords.queryOptions({
			input: { projectId, recordType },
		})
	);
	const setValue = useMutation(orpc.customFields.setValue.mutationOptions());
	const fields = createSurface.data ?? [];
	const recordIds = records.data ?? [];

	const onValueChange = useCallback(
		(definitionId: string, value: CustomFieldStoredValue) => {
			setValues((current) => ({ ...current, [definitionId]: value }));
		},
		[]
	);

	const onCreate = useCallback(async () => {
		if (fields.length === 0) {
			return;
		}
		setError(null);
		markUnsaved();
		const message = await writeCustomFieldValues({
			attempt: attemptOnlineWork,
			fields,
			recordId: draftId,
			recordType,
			setValue: setValue.mutateAsync,
			values,
		});
		if (message) {
			setError(message);
			return;
		}
		await invalidateCustomFieldValues(projectId, recordType, draftId);
		await invalidateCustomFieldValues(projectId, recordType);
		await queryClient.invalidateQueries({
			queryKey: orpc.customFields.listRecords.queryKey({
				input: { projectId, recordType },
			}),
		});
		setSelectedId(draftId);
		setDraftId(crypto.randomUUID());
		setValues({});
		recordSave();
	}, [
		attemptOnlineWork,
		draftId,
		fields,
		markUnsaved,
		projectId,
		recordSave,
		recordType,
		setValue.mutateAsync,
		values,
	]);

	const onClickCreate = useCallback(() => {
		onCreate().catch(() => undefined);
	}, [onCreate]);

	if (fields.length === 0) {
		return null;
	}

	return (
		<section aria-label={recordType}>
			<h2 className="font-medium text-sm">{recordType}</h2>
			<p className="mt-1 text-muted-foreground text-xs">
				{CUSTOM_FIELD_COPY.customField}
			</p>
			<div className="mt-3">
				<CustomFieldValueFields
					fields={fields}
					onValueChange={onValueChange}
					values={values}
				/>
			</div>
			<Button
				className="mt-3"
				disabled={setValue.isPending}
				onClick={onClickCreate}
				type="button"
			>
				{CUSTOM_FIELD_COPY.save}
			</Button>
			{error ? <p role="alert">{error}</p> : null}
			{recordIds.length > 0 ? (
				<ul className="mt-4 flex flex-col gap-2 text-sm">
					{recordIds.map((id) => (
						<FeedbackRecordItem
							id={id}
							key={id}
							onSelect={setSelectedId}
							selected={selectedId === id}
						/>
					))}
				</ul>
			) : null}
			{selectedId ? (
				<div className="mt-4">
					<CustomFieldValuesEditor
						key={selectedId}
						projectId={projectId}
						recordId={selectedId}
						recordType={recordType}
					/>
				</div>
			) : null}
		</section>
	);
}

function FeedbackRecordItem({
	id,
	onSelect,
	selected,
}: {
	id: string;
	onSelect: (id: string) => void;
	selected: boolean;
}) {
	const onClick = useCallback(() => {
		onSelect(id);
	}, [id, onSelect]);
	return (
		<li>
			<Button
				aria-pressed={selected}
				onClick={onClick}
				size="sm"
				type="button"
				variant={selected ? "secondary" : "ghost"}
			>
				{id.slice(0, 8)}
			</Button>
		</li>
	);
}
