import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import { MUTATION_COPY, newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { recordActionMutationError } from "../forms/record-action-mutation-error";
import { RECORD_ACTION_COPY } from "../forms/record-actions-copy";

interface PreviewField {
	from: string | null;
	id: string;
	label: string;
	to: string;
}

interface PreviewOk {
	preview: {
		baseRevision: number;
		fields: PreviewField[];
		fingerprint: string;
	};
	status: "ok";
}

export default function RecordActionRun({
	projectId,
	revision,
	workId,
}: {
	projectId: string;
	revision: number;
	workId: string;
}) {
	const actions = useQuery(
		orpc.recordActions.list.queryOptions({ input: { projectId } })
	);
	const listed = actions.data ?? [];
	if (listed.length === 0) {
		return null;
	}
	return (
		<section aria-label={RECORD_ACTION_COPY.recordAction}>
			<h2 className="font-medium text-sm">{RECORD_ACTION_COPY.recordAction}</h2>
			<ul className="mt-2 flex flex-col gap-3">
				{listed.map((action) => (
					<ActionRun
						action={action}
						key={action.id}
						projectId={projectId}
						revision={revision}
						workId={workId}
					/>
				))}
			</ul>
		</section>
	);
}

function ActionRun({
	action,
	projectId,
	revision,
	workId,
}: {
	action: { id: string; name: string };
	projectId: string;
	revision: number;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [preview, setPreview] = useState<PreviewOk["preview"] | null>(null);
	const [runId, setRunId] = useState<string | null>(null);
	const [undoAvailable, setUndoAvailable] = useState(false);
	const [applyKey] = useState(() => newIdempotencyKey());
	const [undoKey] = useState(() => newIdempotencyKey());
	const previewMutation = useMutation(
		orpc.recordActions.preview.mutationOptions()
	);
	const applyMutation = useMutation(orpc.recordActions.apply.mutationOptions());
	const undoMutation = useMutation(orpc.recordActions.undo.mutationOptions());
	const onStart = useCallback(() => {
		setError(null);
		previewMutation.mutate(
			{
				recordActionId: action.id,
				targetRecordId: workId,
			},
			{
				onSuccess: (outcome) => {
					if (outcome.status !== "ok") {
						setError(recordActionMutationError(outcome));
						return;
					}
					setPreview(outcome.preview);
					setRunId(null);
					setUndoAvailable(false);
				},
			}
		);
	}, [action.id, previewMutation, workId]);
	const onApply = useCallback(async () => {
		if (!preview) {
			return;
		}
		setError(null);
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			applyMutation.mutateAsync({
				baseRevision: preview.baseRevision,
				idempotencyKey: applyKey,
				payload: {
					previewAcknowledged: true,
					previewFingerprint: preview.fingerprint,
					recordActionId: action.id,
					targetRecordId: workId,
				},
			})
		);
		if (result.status === "refused") {
			return;
		}
		const outcome = await result.value;
		const message = recordActionMutationError(outcome);
		if (message) {
			setError(message);
			return;
		}
		if (outcome.status === "committed" || outcome.status === "replayed") {
			setRunId(outcome.run.id);
			setUndoAvailable(outcome.run.undo === MUTATION_COPY.undo);
			setPreview(outcome.run.fields.length > 0 ? preview : null);
			recordSave();
			await invalidateWork(projectId, workId);
		}
	}, [
		action.id,
		applyKey,
		applyMutation,
		attemptOnlineWork,
		markUnsaved,
		preview,
		projectId,
		recordSave,
		workId,
	]);
	const onUndo = useCallback(async () => {
		if (!runId) {
			return;
		}
		setError(null);
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			undoMutation.mutateAsync({
				baseRevision: revision,
				idempotencyKey: undoKey,
				payload: { runId },
			})
		);
		if (result.status === "refused") {
			return;
		}
		const outcome = await result.value;
		const message = recordActionMutationError(outcome);
		if (message) {
			setError(message);
			return;
		}
		if (outcome.status === "committed" || outcome.status === "replayed") {
			setUndoAvailable(false);
			setPreview(null);
			recordSave();
			await invalidateWork(projectId, workId);
		}
	}, [
		attemptOnlineWork,
		markUnsaved,
		projectId,
		recordSave,
		revision,
		runId,
		undoKey,
		undoMutation,
		workId,
	]);
	const onApplyClick = useCallback(() => {
		onApply().catch(() => undefined);
	}, [onApply]);
	const onUndoClick = useCallback(() => {
		onUndo().catch(() => undefined);
	}, [onUndo]);
	const applying = applyMutation.isPending;
	const undoing = undoMutation.isPending;
	return (
		<li className="flex flex-col gap-2 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<p className="font-medium">{action.name}</p>
				<Button onClick={onStart} size="sm" type="button" variant="outline">
					{RECORD_ACTION_COPY.start}
				</Button>
				{preview ? (
					<Button
						disabled={applying}
						onClick={onApplyClick}
						size="sm"
						type="button"
					>
						{applying ? MUTATION_COPY.finalizing : RECORD_ACTION_COPY.apply}
					</Button>
				) : null}
				{undoAvailable ? (
					<Button
						disabled={undoing}
						onClick={onUndoClick}
						size="sm"
						type="button"
						variant="ghost"
					>
						{undoing ? MUTATION_COPY.finalizing : MUTATION_COPY.undo}
					</Button>
				) : null}
			</div>
			{preview && preview.fields.length > 0 ? (
				<ul className="text-muted-foreground">
					{preview.fields.map((field) => (
						<li key={field.id}>
							{field.label}: {field.from ?? "—"} → {field.to}
						</li>
					))}
				</ul>
			) : null}
			{error ? (
				<p className="text-destructive" role="alert">
					{error}
				</p>
			) : null}
		</li>
	);
}
