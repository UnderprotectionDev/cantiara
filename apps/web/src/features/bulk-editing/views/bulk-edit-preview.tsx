import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import {
	type ClosureResult,
	WORK_LIFECYCLE_COPY,
	WORK_STATUSES,
	type WorkStatus,
} from "@/features/work-lifecycle/forms/work-lifecycle-copy";
import { orpc } from "@/utils/orpc";

import { BULK_EDITING_COPY } from "./bulk-editing-copy";

function rejectionCopy(reason: string): string {
	if (reason === "close-step-required") {
		return BULK_EDITING_COPY.closeStepRequired;
	}
	if (reason === "selection-required") {
		return BULK_EDITING_COPY.noSelection;
	}
	if (reason === "schema-or-import-refused") {
		return BULK_EDITING_COPY.schemaOrImportRefused;
	}
	return BULK_EDITING_COPY.targetNotFound;
}

export default function BulkEditPreview({
	filterWorkIds,
	selectedWorkIds,
}: {
	filterWorkIds: string[];
	selectedWorkIds: string[];
}) {
	const [status, setStatus] = useState<WorkStatus | "">("");
	const [title, setTitle] = useState("");
	const [closureResult, setClosureResult] = useState<ClosureResult | "">("");
	const [error, setError] = useState<string | null>(null);
	const preview = useMutation(orpc.bulkEditing.preview.mutationOptions());
	const onStatusChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setStatus(event.target.value as WorkStatus | "");
			setClosureResult("");
		},
		[]
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onClosureChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setClosureResult(event.target.value as ClosureResult | "");
		},
		[]
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			const changes: Record<string, string> = {};
			if (status !== "") {
				changes.status = status;
			}
			if (title.trim() !== "") {
				changes.title = title.trim();
			}
			if (status === "Closed" && closureResult !== "") {
				changes.closureResult = closureResult;
			}
			preview.mutate(
				{
					changes,
					filterWorkIds,
					selectedWorkIds,
				},
				{
					onSuccess: (outcome) => {
						if (outcome.status === "rejected") {
							setError(rejectionCopy(outcome.reason));
						}
					},
				}
			);
		},
		[closureResult, filterWorkIds, preview, selectedWorkIds, status, title]
	);
	const records =
		preview.data?.status === "ok" ? preview.data.preview.records : [];
	const closeCopy =
		preview.data?.status === "rejected" &&
		preview.data.reason === "close-step-required" &&
		"copy" in preview.data.closePreview
			? preview.data.closePreview.copy
			: null;

	return (
		<section
			aria-label={BULK_EDITING_COPY.bulkEdit}
			className="flex flex-col gap-3"
		>
			<h2 className="font-medium text-sm">{BULK_EDITING_COPY.bulkEdit}</h2>
			<p className="text-muted-foreground text-sm">
				{BULK_EDITING_COPY.selectedWork} · {selectedWorkIds.length}
			</p>
			<form className="flex flex-col gap-3" onSubmit={onSubmit}>
				<FieldGroup className="flex-row flex-wrap items-end gap-3">
					<Field className="w-44">
						<FieldLabel htmlFor="bulk-edit-status">
							{WORK_LIFECYCLE_COPY.status}
						</FieldLabel>
						<NativeSelect
							className="w-full"
							id="bulk-edit-status"
							onChange={onStatusChange}
							value={status}
						>
							<NativeSelectOption value="">—</NativeSelectOption>
							{WORK_STATUSES.map((workStatus) => (
								<NativeSelectOption key={workStatus} value={workStatus}>
									{workStatus}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field className="min-w-48 flex-1">
						<FieldLabel htmlFor="bulk-edit-title">
							{WORK_LIFECYCLE_COPY.title}
						</FieldLabel>
						<Input
							id="bulk-edit-title"
							onChange={onTitleChange}
							value={title}
						/>
					</Field>
					{closeCopy ? (
						<Field className="w-44">
							<FieldLabel htmlFor="bulk-edit-close-result">
								{closeCopy.closureCheck}
							</FieldLabel>
							<NativeSelect
								className="w-full"
								id="bulk-edit-close-result"
								onChange={onClosureChange}
								value={closureResult}
							>
								<NativeSelectOption value="">—</NativeSelectOption>
								<NativeSelectOption value={closeCopy.completed}>
									{closeCopy.completed}
								</NativeSelectOption>
								<NativeSelectOption value={closeCopy.abandoned}>
									{closeCopy.abandoned}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
					) : null}
					<Button disabled={preview.isPending} type="submit">
						{BULK_EDITING_COPY.fieldChanges}
					</Button>
				</FieldGroup>
			</form>
			{error ? <p role="alert">{error}</p> : null}
			{records.length > 0 ? (
				<ul className="flex flex-col gap-2 text-sm">
					{records.map((record) => (
						<li key={record.workId}>
							<span className="font-mono text-muted-foreground text-xs">
								{record.key}
							</span>{" "}
							{record.title}
							<ul className="text-muted-foreground">
								{record.fields.map((field) => (
									<li key={field.id}>
										{field.label}: {field.from ?? "—"} → {field.to}
									</li>
								))}
							</ul>
						</li>
					))}
				</ul>
			) : null}
		</section>
	);
}
