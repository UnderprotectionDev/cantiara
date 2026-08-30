import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import { MUTATION_COPY, newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { EXTERNAL_HANDOFFS_COPY } from "./external-handoffs-copy";

interface ProposedRelationDraft {
	id: string;
	toId: string;
	toTitle: string;
}

interface FollowUpDraft {
	id: string;
	title: string;
}

interface HandoffReturnShape {
	id: string;
	reconcileDecision: {
		kind: string;
		selectedFollowUpWorkIds: string[];
		selectedRelationIds: string[];
	} | null;
	returnRecord: {
		changedAssumptions: string;
		executorSummary: string;
		openQuestions: string;
		permittedExternalLinks: Array<{ identifier: string }>;
		producedEvidence: string;
		proposedFollowUpWork: FollowUpDraft[];
		proposedRelations: Array<{
			id: string;
			toId: string;
			toKind: string;
			toTitle: string;
			type: string;
		}>;
	} | null;
	status: string;
}

export default function HandoffReturnActions({
	handoff,
	projectId,
	workId,
}: {
	handoff: HandoffReturnShape;
	projectId: string;
	workId: string;
}) {
	if (handoff.status === EXTERNAL_HANDOFFS_COPY.open) {
		return (
			<RecordReturnForm
				handoffId={handoff.id}
				projectId={projectId}
				workId={workId}
			/>
		);
	}
	if (handoff.status === EXTERNAL_HANDOFFS_COPY.resultReturned) {
		return (
			<ReconcilePanel handoff={handoff} projectId={projectId} workId={workId} />
		);
	}
	if (
		handoff.status === EXTERNAL_HANDOFFS_COPY.reconciled &&
		handoff.reconcileDecision
	) {
		return (
			<dl className="grid gap-1 text-muted-foreground text-xs">
				<div className="flex flex-wrap gap-x-2">
					<dt>{EXTERNAL_HANDOFFS_COPY.reconcile}</dt>
					<dd>{handoff.reconcileDecision.kind}</dd>
				</div>
			</dl>
		);
	}
	return null;
}

async function invalidateHandoffs(projectId: string, workId: string) {
	await queryClient.invalidateQueries({
		queryKey: orpc.externalHandoffs.list.queryKey({
			input: { workId },
		}),
	});
	await invalidateWork(projectId, workId);
}

function RecordReturnForm({
	handoffId,
	projectId,
	workId,
}: {
	handoffId: string;
	projectId: string;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [executorSummary, setExecutorSummary] = useState("");
	const [changedAssumptions, setChangedAssumptions] = useState("");
	const [producedEvidence, setProducedEvidence] = useState("");
	const [openQuestions, setOpenQuestions] = useState("");
	const [links, setLinks] = useState("");
	const [relations, setRelations] = useState<ProposedRelationDraft[]>([]);
	const [followUps, setFollowUps] = useState<FollowUpDraft[]>([]);
	const [error, setError] = useState<string | null>(null);
	const record = useMutation(
		orpc.externalHandoffs.recordReturn.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateHandoffs(projectId, workId);
					recordSave();
					setError(null);
					return;
				}
				setError(MUTATION_COPY.conflict);
			},
		})
	);
	const onAddRelation = useCallback(() => {
		setRelations((current) => [
			...current,
			{ id: crypto.randomUUID(), toId: "", toTitle: "" },
		]);
	}, []);
	const onAddFollowUp = useCallback(() => {
		setFollowUps((current) => [
			...current,
			{ id: crypto.randomUUID(), title: "" },
		]);
	}, []);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				record.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						changedAssumptions,
						executorSummary,
						handoffId,
						openQuestions,
						permittedExternalLinks: links
							.split(",")
							.map((identifier) => identifier.trim())
							.filter((identifier) => identifier.length > 0)
							.map((identifier) => ({ identifier })),
						producedEvidence,
						proposedFollowUpWork: followUps.filter(
							(item) => item.title.trim() !== ""
						),
						proposedRelations: relations
							.filter((item) => item.toId.trim() !== "")
							.map((item) => ({
								id: item.id,
								toId: item.toId.trim(),
								toKind: "Work" as const,
								toTitle: item.toTitle,
								type: EXTERNAL_HANDOFFS_COPY.related,
							})),
					},
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[
			attemptOnlineWork,
			changedAssumptions,
			executorSummary,
			followUps,
			handoffId,
			links,
			markUnsaved,
			openQuestions,
			producedEvidence,
			record,
			relations,
		]
	);
	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldSet>
				<FieldLegend>{EXTERNAL_HANDOFFS_COPY.recordReturn}</FieldLegend>
				<FieldGroup>
					<LabeledArea
						id={`return-summary-${handoffId}`}
						label={EXTERNAL_HANDOFFS_COPY.executorSummary}
						onValueChange={setExecutorSummary}
						value={executorSummary}
					/>
					<LabeledArea
						id={`return-assumptions-${handoffId}`}
						label={EXTERNAL_HANDOFFS_COPY.changedAssumptions}
						onValueChange={setChangedAssumptions}
						value={changedAssumptions}
					/>
					<LabeledArea
						id={`return-evidence-${handoffId}`}
						label={EXTERNAL_HANDOFFS_COPY.producedEvidence}
						onValueChange={setProducedEvidence}
						value={producedEvidence}
					/>
					<LabeledArea
						id={`return-questions-${handoffId}`}
						label={EXTERNAL_HANDOFFS_COPY.openQuestions}
						onValueChange={setOpenQuestions}
						value={openQuestions}
					/>
					<LabeledInput
						id={`return-links-${handoffId}`}
						label={EXTERNAL_HANDOFFS_COPY.permittedExternalLinks}
						onValueChange={setLinks}
						value={links}
					/>
				</FieldGroup>
			</FieldSet>
			{relations.map((item) => (
				<ProposedRelationFields
					handoffId={handoffId}
					item={item}
					key={item.id}
					onRemove={setRelations}
					onValueChange={setRelations}
				/>
			))}
			{followUps.map((item) => (
				<FollowUpFields
					handoffId={handoffId}
					item={item}
					key={item.id}
					onRemove={setFollowUps}
					onValueChange={setFollowUps}
				/>
			))}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-wrap gap-2">
					<Button
						onClick={onAddRelation}
						size="sm"
						type="button"
						variant="outline"
					>
						{EXTERNAL_HANDOFFS_COPY.addProposedRelation}
					</Button>
					<Button
						onClick={onAddFollowUp}
						size="sm"
						type="button"
						variant="outline"
					>
						{EXTERNAL_HANDOFFS_COPY.addFollowUpWork}
					</Button>
				</div>
				<Button disabled={record.isPending} type="submit">
					{EXTERNAL_HANDOFFS_COPY.recordReturn}
				</Button>
			</div>
			{error ? <p role="alert">{error}</p> : null}
		</form>
	);
}

function ReconcilePanel({
	handoff,
	projectId,
	workId,
}: {
	handoff: HandoffReturnShape;
	projectId: string;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [open, setOpen] = useState(false);
	const [selectedRelationIds, setSelectedRelationIds] = useState<string[]>([]);
	const [selectedFollowUpWorkIds, setSelectedFollowUpWorkIds] = useState<
		string[]
	>([]);
	const [error, setError] = useState<string | null>(null);
	const preview = useQuery({
		...orpc.externalHandoffs.previewReconcile.queryOptions({
			input: { handoffId: handoff.id },
		}),
		enabled: open,
	});
	const previewData =
		preview.data?.status === "ok" ? preview.data.preview : null;
	useEffect(() => {
		if (!previewData) {
			return;
		}
		setSelectedRelationIds(previewData.relations.map((item) => item.id));
		setSelectedFollowUpWorkIds(previewData.followUpWork.map((item) => item.id));
	}, [previewData]);
	const confirm = useMutation(
		orpc.externalHandoffs.confirmReconcile.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateHandoffs(projectId, workId);
					recordSave();
					setError(null);
					return;
				}
				setError(MUTATION_COPY.conflict);
			},
		})
	);
	const reject = useMutation(
		orpc.externalHandoffs.rejectReconcile.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateHandoffs(projectId, workId);
					recordSave();
					setOpen(false);
					setError(null);
					return;
				}
				setError(MUTATION_COPY.conflict);
			},
		})
	);
	const onOpenPreview = useCallback(() => {
		setOpen(true);
	}, []);
	const onToggleRelation = useCallback((id: string, checked: boolean) => {
		setSelectedRelationIds((current) =>
			checked ? [...current, id] : current.filter((item) => item !== id)
		);
	}, []);
	const onToggleFollowUp = useCallback((id: string, checked: boolean) => {
		setSelectedFollowUpWorkIds((current) =>
			checked ? [...current, id] : current.filter((item) => item !== id)
		);
	}, []);
	const onConfirm = useCallback(() => {
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			confirm.mutateAsync({
				idempotencyKey: newIdempotencyKey(),
				payload: {
					handoffId: handoff.id,
					previewAcknowledged: true,
					selectedFollowUpWorkIds,
					selectedRelationIds,
				},
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [
		attemptOnlineWork,
		confirm,
		handoff.id,
		markUnsaved,
		selectedFollowUpWorkIds,
		selectedRelationIds,
	]);
	const onReject = useCallback(() => {
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			reject.mutateAsync({
				idempotencyKey: newIdempotencyKey(),
				payload: { handoffId: handoff.id },
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [attemptOnlineWork, handoff.id, markUnsaved, reject]);
	const returned = handoff.returnRecord;
	return (
		<div className="flex flex-col gap-3">
			{returned ? (
				<dl className="grid gap-1 text-muted-foreground text-xs">
					<div className="flex flex-wrap gap-x-2">
						<dt>{EXTERNAL_HANDOFFS_COPY.executorSummary}</dt>
						<dd>{returned.executorSummary}</dd>
					</div>
					<div className="flex flex-wrap gap-x-2">
						<dt>{EXTERNAL_HANDOFFS_COPY.changedAssumptions}</dt>
						<dd>{returned.changedAssumptions}</dd>
					</div>
					<div className="flex flex-wrap gap-x-2">
						<dt>{EXTERNAL_HANDOFFS_COPY.producedEvidence}</dt>
						<dd>{returned.producedEvidence}</dd>
					</div>
					<div className="flex flex-wrap gap-x-2">
						<dt>{EXTERNAL_HANDOFFS_COPY.openQuestions}</dt>
						<dd>{returned.openQuestions}</dd>
					</div>
				</dl>
			) : null}
			{open && previewData ? (
				<div className="flex flex-col gap-3 border p-3">
					<p className="font-medium text-xs">
						{EXTERNAL_HANDOFFS_COPY.reconcile}
					</p>
					{previewData.relations.map((item) => (
						<PreviewChoice
							checked={selectedRelationIds.includes(item.id)}
							htmlId={`reconcile-rel-${item.id}`}
							itemId={item.id}
							key={item.id}
							label={`${EXTERNAL_HANDOFFS_COPY.related} ${item.toTitle}`}
							onToggle={onToggleRelation}
						/>
					))}
					{previewData.followUpWork.map((item) => (
						<PreviewChoice
							checked={selectedFollowUpWorkIds.includes(item.id)}
							htmlId={`reconcile-work-${item.id}`}
							itemId={item.id}
							key={item.id}
							label={`${EXTERNAL_HANDOFFS_COPY.followUpWork} ${item.title}`}
							onToggle={onToggleFollowUp}
						/>
					))}
					<div className="flex flex-wrap justify-end gap-2">
						<Button
							onClick={onReject}
							size="sm"
							type="button"
							variant="outline"
						>
							{EXTERNAL_HANDOFFS_COPY.reject}
						</Button>
						<Button
							disabled={confirm.isPending}
							onClick={onConfirm}
							size="sm"
							type="button"
						>
							{EXTERNAL_HANDOFFS_COPY.confirm}
						</Button>
					</div>
				</div>
			) : (
				<Button onClick={onOpenPreview} size="sm" type="button">
					{EXTERNAL_HANDOFFS_COPY.reconcile}
				</Button>
			)}
			{error ? <p role="alert">{error}</p> : null}
		</div>
	);
}

function PreviewChoice({
	checked,
	htmlId,
	itemId,
	label,
	onToggle,
}: {
	checked: boolean;
	htmlId: string;
	itemId: string;
	label: string;
	onToggle: (id: string, checked: boolean) => void;
}) {
	const onCheckedChange = useCallback(
		(value: boolean | "indeterminate") => {
			onToggle(itemId, value === true);
		},
		[itemId, onToggle]
	);
	return (
		<Field
			className="flex flex-row items-center gap-2"
			orientation="horizontal"
		>
			<Checkbox
				checked={checked}
				id={htmlId}
				onCheckedChange={onCheckedChange}
			/>
			<FieldLabel htmlFor={htmlId}>{label}</FieldLabel>
		</Field>
	);
}

function ProposedRelationFields({
	handoffId,
	item,
	onRemove,
	onValueChange,
}: {
	handoffId: string;
	item: ProposedRelationDraft;
	onRemove: Dispatch<SetStateAction<ProposedRelationDraft[]>>;
	onValueChange: Dispatch<SetStateAction<ProposedRelationDraft[]>>;
}) {
	const onToId = useCallback(
		(value: string) => {
			onValueChange((current) =>
				current.map((row) =>
					row.id === item.id ? { ...row, toId: value } : row
				)
			);
		},
		[item.id, onValueChange]
	);
	const onTitle = useCallback(
		(value: string) => {
			onValueChange((current) =>
				current.map((row) =>
					row.id === item.id ? { ...row, toTitle: value } : row
				)
			);
		},
		[item.id, onValueChange]
	);
	const onRemoveClick = useCallback(() => {
		onRemove((current) => current.filter((row) => row.id !== item.id));
	}, [item.id, onRemove]);
	return (
		<FieldGroup className="border p-3">
			<LabeledInput
				id={`return-to-${handoffId}-${item.id}`}
				label={EXTERNAL_HANDOFFS_COPY.toWork}
				onValueChange={onToId}
				value={item.toId}
			/>
			<LabeledInput
				id={`return-to-title-${handoffId}-${item.id}`}
				label={EXTERNAL_HANDOFFS_COPY.title}
				onValueChange={onTitle}
				value={item.toTitle}
			/>
			<Button onClick={onRemoveClick} size="sm" type="button" variant="ghost">
				{EXTERNAL_HANDOFFS_COPY.removeProposedRelation}
			</Button>
		</FieldGroup>
	);
}

function FollowUpFields({
	handoffId,
	item,
	onRemove,
	onValueChange,
}: {
	handoffId: string;
	item: FollowUpDraft;
	onRemove: Dispatch<SetStateAction<FollowUpDraft[]>>;
	onValueChange: Dispatch<SetStateAction<FollowUpDraft[]>>;
}) {
	const onTitle = useCallback(
		(value: string) => {
			onValueChange((current) =>
				current.map((row) =>
					row.id === item.id ? { ...row, title: value } : row
				)
			);
		},
		[item.id, onValueChange]
	);
	const onRemoveClick = useCallback(() => {
		onRemove((current) => current.filter((row) => row.id !== item.id));
	}, [item.id, onRemove]);
	return (
		<FieldGroup className="border p-3">
			<LabeledInput
				id={`return-follow-${handoffId}-${item.id}`}
				label={EXTERNAL_HANDOFFS_COPY.followUpWork}
				onValueChange={onTitle}
				value={item.title}
			/>
			<Button onClick={onRemoveClick} size="sm" type="button" variant="ghost">
				{EXTERNAL_HANDOFFS_COPY.removeFollowUpWork}
			</Button>
		</FieldGroup>
	);
}

function LabeledInput({
	id,
	label,
	onValueChange,
	value,
}: {
	id: string;
	label: string;
	onValueChange: (value: string) => void;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input id={id} onChange={onChange} value={value} />
		</Field>
	);
}

function LabeledArea({
	id,
	label,
	onValueChange,
	value,
}: {
	id: string;
	label: string;
	onValueChange: (value: string) => void;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Textarea id={id} onChange={onChange} rows={3} value={value} />
		</Field>
	);
}
