import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent, MouseEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { WORK_CHECKLISTS_COPY } from "./work-checklists-copy";

interface ChecklistItem {
	completed: boolean;
	convertedWork?: { id: string; key: string };
	id: string;
	title: string;
}

export default function WorkChecklistPanel({
	onOpenSourceRecord,
	projectId,
	revision,
	workId,
}: {
	onOpenSourceRecord?: (id: string) => void;
	projectId: string;
	revision: number;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [title, setTitle] = useState("");
	const [error, setError] = useState<string | null>(null);
	const checklist = useQuery(
		orpc.workChecklists.get.queryOptions({ input: { workId } })
	);
	const onOutcome = useCallback(
		async (outcome: { status: string }) => {
			if (outcome.status === "committed" || outcome.status === "replayed") {
				await invalidateWork(projectId, workId);
				await queryClient.invalidateQueries({
					queryKey: orpc.workChecklists.get.queryKey({
						input: { workId },
					}),
				});
				await queryClient.invalidateQueries({
					queryKey: orpc.relations.list.queryKey({
						input: { id: workId, kind: "Work" },
					}),
				});
				recordSave();
				setError(null);
				return;
			}
			setError("Conflict");
		},
		[projectId, recordSave, workId]
	);
	const add = useMutation(
		orpc.workChecklists.add.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					setTitle("");
				}
				await onOutcome(outcome);
			},
		})
	);
	const update = useMutation(
		orpc.workChecklists.update.mutationOptions({
			onSuccess: onOutcome,
		})
	);
	const setCompleted = useMutation(
		orpc.workChecklists.setCompleted.mutationOptions({
			onSuccess: onOutcome,
		})
	);
	const reorder = useMutation(
		orpc.workChecklists.reorder.mutationOptions({
			onSuccess: onOutcome,
		})
	);
	const remove = useMutation(
		orpc.workChecklists.remove.mutationOptions({
			onSuccess: onOutcome,
		})
	);
	const convert = useMutation(
		orpc.workChecklists.convert.mutationOptions({
			onSuccess: onOutcome,
		})
	);
	const items = checklist.data?.items ?? [];
	const itemIds = items.map((row) => row.id);
	const liveRevision = checklist.data?.work.revision ?? revision;
	const pending =
		add.isPending ||
		update.isPending ||
		setCompleted.isPending ||
		reorder.isPending ||
		remove.isPending ||
		convert.isPending;
	const onAdd = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				add.mutateAsync({
					baseRevision: liveRevision,
					idempotencyKey: newIdempotencyKey(),
					title,
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[add, attemptOnlineWork, liveRevision, markUnsaved, title, workId]
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.currentTarget.value);
	}, []);
	if (checklist.isPending) {
		return null;
	}
	if (checklist.isError || !checklist.data) {
		return <p role="alert">{WORK_CHECKLISTS_COPY.checklist}</p>;
	}
	return (
		<section
			aria-label={WORK_CHECKLISTS_COPY.checklist}
			className="flex flex-col gap-3"
		>
			<h3 className="font-medium text-sm tracking-tight">
				{WORK_CHECKLISTS_COPY.checklist}
			</h3>
			{items.length > 0 ? (
				<ul className="flex flex-col gap-2">
					{items.map((item, index) => (
						<ChecklistItemRow
							attemptOnlineWork={attemptOnlineWork}
							convertItem={convert.mutateAsync}
							disabled={pending}
							index={index}
							item={item}
							itemIds={itemIds}
							key={item.id}
							liveRevision={liveRevision}
							markUnsaved={markUnsaved}
							onOpenSourceRecord={onOpenSourceRecord}
							removeItem={remove.mutateAsync}
							reorderItems={reorder.mutateAsync}
							setItemCompleted={setCompleted.mutateAsync}
							updateItem={update.mutateAsync}
							workId={workId}
						/>
					))}
				</ul>
			) : null}
			<form className="flex flex-col gap-3" onSubmit={onAdd}>
				<FieldGroup className="flex-row flex-wrap items-end gap-3">
					<Field>
						<FieldLabel htmlFor={`checklist-item-${workId}`}>
							{WORK_CHECKLISTS_COPY.item}
						</FieldLabel>
						<Input
							id={`checklist-item-${workId}`}
							onChange={onTitleChange}
							value={title}
						/>
					</Field>
					<Button disabled={pending} type="submit">
						{WORK_CHECKLISTS_COPY.addItem}
					</Button>
				</FieldGroup>
			</form>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}

function ChecklistItemRow({
	attemptOnlineWork,
	convertItem,
	disabled,
	index,
	item,
	itemIds,
	liveRevision,
	markUnsaved,
	onOpenSourceRecord,
	removeItem,
	reorderItems,
	setItemCompleted,
	updateItem,
	workId,
}: {
	attemptOnlineWork: ReturnType<typeof useClientShell>["attemptOnlineWork"];
	convertItem: (input: {
		baseRevision: number;
		idempotencyKey: string;
		itemId: string;
		previewAcknowledged: boolean;
		workId: string;
	}) => Promise<{ status: string }>;
	disabled: boolean;
	index: number;
	item: ChecklistItem;
	itemIds: string[];
	liveRevision: number;
	markUnsaved: ReturnType<typeof useClientShell>["markUnsaved"];
	onOpenSourceRecord?: (id: string) => void;
	removeItem: (input: {
		baseRevision: number;
		idempotencyKey: string;
		itemId: string;
		workId: string;
	}) => Promise<{ status: string }>;
	reorderItems: (input: {
		baseRevision: number;
		idempotencyKey: string;
		orderedItemIds: string[];
		workId: string;
	}) => Promise<{ status: string }>;
	setItemCompleted: (input: {
		baseRevision: number;
		completed: boolean;
		idempotencyKey: string;
		itemId: string;
		workId: string;
	}) => Promise<{ status: string }>;
	updateItem: (input: {
		baseRevision: number;
		idempotencyKey: string;
		itemId: string;
		title: string;
		workId: string;
	}) => Promise<{ status: string }>;
	workId: string;
}) {
	const [value, setValue] = useState(item.title);
	const runWrite = useCallback(
		(work: () => Promise<{ status: string }>) => {
			markUnsaved();
			const result = attemptOnlineWork("record-create", work);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, markUnsaved]
	);
	const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setValue(event.currentTarget.value);
	}, []);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			runWrite(() =>
				updateItem({
					baseRevision: liveRevision,
					idempotencyKey: newIdempotencyKey(),
					itemId: item.id,
					title: value,
					workId,
				})
			);
		},
		[item.id, liveRevision, runWrite, updateItem, value, workId]
	);
	const onCheckedChange = useCallback(
		(checked: boolean | "indeterminate") => {
			runWrite(() =>
				setItemCompleted({
					baseRevision: liveRevision,
					completed: checked === true,
					idempotencyKey: newIdempotencyKey(),
					itemId: item.id,
					workId,
				})
			);
		},
		[item.id, liveRevision, runWrite, setItemCompleted, workId]
	);
	const onRemove = useCallback(() => {
		runWrite(() =>
			removeItem({
				baseRevision: liveRevision,
				idempotencyKey: newIdempotencyKey(),
				itemId: item.id,
				workId,
			})
		);
	}, [item.id, liveRevision, removeItem, runWrite, workId]);
	const onMove = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			const direction = Number(event.currentTarget.value);
			const nextIndex = index + direction;
			if (nextIndex < 0 || nextIndex >= itemIds.length) {
				return;
			}
			const next = [...itemIds];
			const [moved] = next.splice(index, 1);
			if (!moved) {
				return;
			}
			next.splice(nextIndex, 0, moved);
			runWrite(() =>
				reorderItems({
					baseRevision: liveRevision,
					idempotencyKey: newIdempotencyKey(),
					orderedItemIds: next,
					workId,
				})
			);
		},
		[index, itemIds, liveRevision, reorderItems, runWrite, workId]
	);
	const [previewOpen, setPreviewOpen] = useState(false);
	const onOpenPreview = useCallback(() => {
		setPreviewOpen(true);
	}, []);
	const onOpenConverted = useCallback(() => {
		if (item.convertedWork) {
			onOpenSourceRecord?.(item.convertedWork.id);
		}
	}, [item.convertedWork, onOpenSourceRecord]);
	if (item.convertedWork) {
		return (
			<li className="flex flex-col gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<Button
						onClick={onOpenConverted}
						size="sm"
						type="button"
						variant="link"
					>
						{item.convertedWork.key}
					</Button>
					<Button
						disabled={disabled || index === 0}
						onClick={onMove}
						size="sm"
						type="button"
						value="-1"
						variant="ghost"
					>
						{WORK_CHECKLISTS_COPY.moveUp}
					</Button>
					<Button
						disabled={disabled || index === itemIds.length - 1}
						onClick={onMove}
						size="sm"
						type="button"
						value="1"
						variant="ghost"
					>
						{WORK_CHECKLISTS_COPY.moveDown}
					</Button>
					<Button
						disabled={disabled}
						onClick={onRemove}
						size="sm"
						type="button"
						variant="ghost"
					>
						{WORK_CHECKLISTS_COPY.remove}
					</Button>
				</div>
			</li>
		);
	}
	return (
		<li className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<Checkbox
					aria-label={item.title}
					checked={item.completed}
					disabled={disabled}
					id={`checklist-done-${item.id}`}
					onCheckedChange={onCheckedChange}
				/>
				<form
					className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
					onSubmit={onSubmit}
				>
					<Field className="min-w-40 flex-1">
						<FieldLabel htmlFor={`checklist-title-${item.id}`}>
							{WORK_CHECKLISTS_COPY.item}
						</FieldLabel>
						<Input
							id={`checklist-title-${item.id}`}
							onChange={onChange}
							value={value}
						/>
					</Field>
					<Button disabled={disabled} size="sm" type="submit">
						{WORK_CHECKLISTS_COPY.save}
					</Button>
				</form>
				<Button
					disabled={disabled}
					onClick={onOpenPreview}
					size="sm"
					type="button"
					variant="outline"
				>
					{WORK_CHECKLISTS_COPY.convertToIndependentWork}
				</Button>
				<Button
					disabled={disabled || index === 0}
					onClick={onMove}
					size="sm"
					type="button"
					value="-1"
					variant="ghost"
				>
					{WORK_CHECKLISTS_COPY.moveUp}
				</Button>
				<Button
					disabled={disabled || index === itemIds.length - 1}
					onClick={onMove}
					size="sm"
					type="button"
					value="1"
					variant="ghost"
				>
					{WORK_CHECKLISTS_COPY.moveDown}
				</Button>
				<Button
					disabled={disabled}
					onClick={onRemove}
					size="sm"
					type="button"
					variant="ghost"
				>
					{WORK_CHECKLISTS_COPY.remove}
				</Button>
			</div>
			<ConvertChecklistDialog
				convertItem={convertItem}
				itemId={item.id}
				liveRevision={liveRevision}
				onOpenChange={setPreviewOpen}
				open={previewOpen}
				runWrite={runWrite}
				workId={workId}
			/>
		</li>
	);
}

function ConvertChecklistDialog({
	convertItem,
	itemId,
	liveRevision,
	onOpenChange,
	open,
	runWrite,
	workId,
}: {
	convertItem: (input: {
		baseRevision: number;
		idempotencyKey: string;
		itemId: string;
		previewAcknowledged: boolean;
		workId: string;
	}) => Promise<{ status: string }>;
	itemId: string;
	liveRevision: number;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	runWrite: (work: () => Promise<{ status: string }>) => void;
	workId: string;
}) {
	const preview = useQuery({
		...orpc.workChecklists.previewConvert.queryOptions({
			input: { itemId, workId },
		}),
		enabled: open,
	});
	const previewData =
		preview.data && preview.data.status === "ok" ? preview.data.preview : null;
	const onConfirm = useCallback(() => {
		if (!previewData) {
			return;
		}
		runWrite(() =>
			convertItem({
				baseRevision: liveRevision,
				idempotencyKey: newIdempotencyKey(),
				itemId,
				previewAcknowledged: true,
				workId,
			})
		);
		onOpenChange(false);
	}, [
		convertItem,
		itemId,
		liveRevision,
		onOpenChange,
		previewData,
		runWrite,
		workId,
	]);
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{WORK_CHECKLISTS_COPY.convertToIndependentWork}
					</DialogTitle>
				</DialogHeader>
				{previewData ? (
					<dl className="grid gap-2 text-sm">
						<div className="flex gap-2">
							<dt className="text-muted-foreground">
								{WORK_CHECKLISTS_COPY.title}
							</dt>
							<dd>{previewData.title}</dd>
						</div>
						<div className="flex gap-2">
							<dt className="text-muted-foreground">
								{WORK_CHECKLISTS_COPY.project}
							</dt>
							<dd>{previewData.projectName}</dd>
						</div>
						<div className="flex gap-2">
							<dt className="text-muted-foreground">
								{WORK_CHECKLISTS_COPY.startStatus}
							</dt>
							<dd>{previewData.startStatus}</dd>
						</div>
					</dl>
				) : null}
				<DialogFooter>
					<Button disabled={!previewData} onClick={onConfirm} type="button">
						{WORK_CHECKLISTS_COPY.confirmConvert}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
