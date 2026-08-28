import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { orpc, queryClient } from "@/utils/orpc";

import { CustomFieldValueFields } from "./custom-field-value-control";
import {
	CUSTOM_FIELD_COPY,
	type CustomFieldStoredValue,
} from "./custom-fields-copy";
import { writeCustomFieldValues } from "./write-custom-field-values";

export async function invalidateCustomFieldValues(
	projectId: string,
	recordType: string,
	recordId?: string
) {
	await queryClient.invalidateQueries({
		queryKey: orpc.customFields.surface.queryKey({
			input: { projectId, recordId, recordType },
		}),
	});
	await queryClient.invalidateQueries({
		queryKey: orpc.customFields.searchFields.queryKey({
			input: { projectId, recordType },
		}),
	});
}

export default function CustomFieldValuesEditor({
	projectId,
	recordId,
	recordType,
}: {
	projectId: string;
	recordId: string;
	recordType: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [values, setValues] = useState<Record<string, CustomFieldStoredValue>>(
		{}
	);
	const surface = useQuery(
		orpc.customFields.surface.queryOptions({
			input: { projectId, recordId, recordType },
		})
	);
	const setValue = useMutation(orpc.customFields.setValue.mutationOptions());

	useEffect(() => {
		if (!surface.data) {
			return;
		}
		setValues(
			Object.fromEntries(
				surface.data.map((field) => [field.definitionId, field.value])
			)
		);
	}, [surface.data]);

	const onValueChange = useCallback(
		(definitionId: string, value: CustomFieldStoredValue) => {
			setValues((current) => ({ ...current, [definitionId]: value }));
		},
		[]
	);

	const onSave = useCallback(async () => {
		if (!surface.data) {
			return;
		}
		setError(null);
		markUnsaved();
		const message = await writeCustomFieldValues({
			attempt: attemptOnlineWork,
			fields: surface.data,
			recordId,
			recordType,
			setValue: setValue.mutateAsync,
			values,
		});
		if (message) {
			setError(message);
			return;
		}
		await invalidateCustomFieldValues(projectId, recordType, recordId);
		recordSave();
	}, [
		attemptOnlineWork,
		markUnsaved,
		projectId,
		recordId,
		recordSave,
		recordType,
		setValue.mutateAsync,
		surface.data,
		values,
	]);

	const onClickSave = useCallback(() => {
		onSave().catch(() => undefined);
	}, [onSave]);

	if (!surface.data || surface.data.length === 0) {
		return null;
	}

	return (
		<section aria-label={CUSTOM_FIELD_COPY.customField}>
			<CustomFieldValueFields
				fields={surface.data}
				onValueChange={onValueChange}
				values={values}
			/>
			<Button
				className="mt-3"
				disabled={setValue.isPending}
				onClick={onClickSave}
				type="button"
			>
				{CUSTOM_FIELD_COPY.save}
			</Button>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}
