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
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import {
	type ClosureResult,
	WORK_LIFECYCLE_COPY,
	WORK_STATUSES,
	type WorkStatus,
} from "@/features/work-lifecycle/forms/work-lifecycle-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { BULK_EDITING_COPY } from "./bulk-editing-copy";

function resultLabel(
	result: "pending" | "succeeded" | "failed",
	pendingLabel: string
): string {
	if (result === "succeeded") {
		return BULK_EDITING_COPY.succeeded;
	}
	if (result === "failed") {
		return BULK_EDITING_COPY.failed;
	}
	return pendingLabel;
}

function recordsForUndo(
	polled:
		| {
				job?: { records: Array<{ historyEntryId?: string; workId: string }> };
				status: string;
		  }
		| undefined,
	applied:
		| {
				job?: { records: Array<{ historyEntryId?: string; workId: string }> };
				status: string;
		  }
		| undefined
) {
	if (polled?.status === "ok" && polled.job) {
		const { records } = polled.job;
		return records;
	}
	if (applied?.status === "ok" && applied.job) {
		const { records } = applied.job;
		return records;
	}
	return [];
}

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
	projectId,
	selectedWorkIds,
}: {
	filterWorkIds: string[];
	projectId: string;
	selectedWorkIds: string[];
}) {
	const [status, setStatus] = useState<WorkStatus | "">("");
	const [title, setTitle] = useState("");
	const [closureResult, setClosureResult] = useState<ClosureResult | "">("");
	const [error, setError] = useState<string | null>(null);
	const [jobId, setJobId] = useState<string | null>(null);
	const preview = useMutation(orpc.bulkEditing.preview.mutationOptions());
	const apply = useMutation(orpc.bulkEditing.apply.mutationOptions());
	const cancel = useMutation(orpc.bulkEditing.cancel.mutationOptions());
	const undo = useMutation(orpc.bulkEditing.undo.mutationOptions());
	const work = useQuery(
		orpc.workLifecycle.list.queryOptions({
			input: { projectId },
		})
	);
	const jobQuery = useQuery({
		...orpc.bulkEditing.get.queryOptions({
			input: { jobId: jobId ?? "" },
		}),
		enabled: Boolean(jobId),
		refetchInterval: (query) => {
			const outcome = query.state.data;
			if (
				outcome?.status === "ok" &&
				outcome.job.status !== "cancelled" &&
				outcome.job.progress.completed < outcome.job.progress.total
			) {
				return 250;
			}
			return false;
		},
	});
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
	const buildChanges = useCallback(() => {
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
		return changes;
	}, [closureResult, status, title]);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			preview.mutate(
				{
					changes: buildChanges(),
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
		[buildChanges, filterWorkIds, preview, selectedWorkIds]
	);
	const onApply = useCallback(() => {
		const records =
			preview.data?.status === "ok"
				? preview.data.preview.records.map((record) => ({
						baseRevision: record.revision,
						idempotencyKey: newIdempotencyKey(),
						workId: record.workId,
					}))
				: [];
		if (records.length === 0) {
			return;
		}
		setError(null);
		apply.mutate(
			{
				changes: buildChanges(),
				idempotencyKey: newIdempotencyKey(),
				records,
				selectedWorkIds,
			},
			{
				onSuccess: (outcome) => {
					if (outcome.status === "rejected") {
						setError(rejectionCopy(outcome.reason));
						return;
					}
					setJobId(outcome.job.jobId);
				},
			}
		);
	}, [apply, buildChanges, preview.data, selectedWorkIds]);
	const onCancel = useCallback(() => {
		if (!jobId) {
			return;
		}
		cancel.mutate({ jobId });
	}, [cancel, jobId]);
	const onUndoClick = useCallback(
		(event: { currentTarget: { value: string } }) => {
			const workId = event.currentTarget.value;
			if (!jobId) {
				return;
			}
			const record = recordsForUndo(jobQuery.data, apply.data).find(
				(item) => item.workId === workId
			);
			if (!record?.historyEntryId) {
				return;
			}
			const current = work.data?.find((item) => item.id === record.workId);
			if (!current) {
				return;
			}
			undo.mutate(
				{
					baseRevision: current.revision,
					historyEntryId: record.historyEntryId,
					idempotencyKey: newIdempotencyKey(),
					jobId,
					workId: record.workId,
				},
				{
					onSuccess: async () => {
						await invalidateWork(projectId, record.workId);
					},
				}
			);
		},
		[apply.data, jobId, jobQuery.data, projectId, undo, work.data]
	);
	const previewRecords =
		preview.data?.status === "ok" ? preview.data.preview.records : [];
	const polledJob = jobQuery.data?.status === "ok" ? jobQuery.data.job : null;
	const appliedJob = apply.data?.status === "ok" ? apply.data.job : null;
	const job = polledJob ?? appliedJob;
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
			{selectedWorkIds.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{BULK_EDITING_COPY.noSelection}
				</p>
			) : (
				<p className="text-muted-foreground text-sm">
					{BULK_EDITING_COPY.selectedWork} · {selectedWorkIds.length}
				</p>
			)}
			{selectedWorkIds.length === 0 ? null : (
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
			)}
			{error ? <p role="alert">{error}</p> : null}
			{previewRecords.length > 0 ? (
				<ul className="flex flex-col gap-2 text-sm">
					{previewRecords.map((record) => (
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
			{previewRecords.length > 0 ? (
				<Button disabled={apply.isPending} onClick={onApply} type="button">
					{BULK_EDITING_COPY.apply}
				</Button>
			) : null}
			{job ? (
				<div aria-live="polite" className="flex flex-col gap-2">
					<p className="text-sm">
						{BULK_EDITING_COPY.progress} · {job.progress.completed} /{" "}
						{job.progress.total} · {job.actor}
					</p>
					{job.ui.cancelAvailable ? (
						<Button
							disabled={cancel.isPending}
							onClick={onCancel}
							type="button"
							variant="ghost"
						>
							{job.ui.label}
						</Button>
					) : (
						<p className="text-muted-foreground text-sm">{job.ui.label}</p>
					)}
					<ul className="flex flex-col gap-2 text-sm">
						{job.records.map((record) => (
							<li key={record.workId}>
								<span className="font-mono text-muted-foreground text-xs">
									{record.key}
								</span>{" "}
								{resultLabel(record.result, BULK_EDITING_COPY.progress)}
								{record.conflict ? ` · ${record.conflict}` : null}
								{record.currentValueLabel ? (
									<p>{record.currentValueLabel}</p>
								) : null}
								{record.supportReference ? (
									<p>
										{BULK_EDITING_COPY.supportReference}{" "}
										{record.supportReference}
									</p>
								) : null}
								{record.undo && record.historyEntryId ? (
									<Button
										disabled={undo.isPending}
										onClick={onUndoClick}
										size="sm"
										type="button"
										value={record.workId}
										variant="ghost"
									>
										{record.undo}
									</Button>
								) : null}
							</li>
						))}
					</ul>
				</div>
			) : null}
		</section>
	);
}
