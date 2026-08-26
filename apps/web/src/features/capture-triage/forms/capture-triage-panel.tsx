import { Button } from "@cantiara/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useCallback, useState } from "react";
import { MUTATION_COPY, newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";
import {
	type ConvertTargetKind,
	convertTargetOptions,
	mergeUndoPreviewLines,
	otherProjectGroups,
} from "./capture-triage-exits-state";

function isNotFound(value: unknown): value is { status: "not-found" } {
	return (
		typeof value === "object" &&
		value !== null &&
		"status" in value &&
		value.status === "not-found"
	);
}

export interface TriageCopy {
	attachToExisting: string;
	convert: string;
	delete: string;
	document: string;
	evidence: string;
	fileAttachment: string;
	origin: string;
	otherProjects: string;
	work: string;
}

export function CaptureTriageActions({
	copy,
	itemId,
	onItemConsumed,
	onMergeConsumed,
}: {
	copy: TriageCopy;
	itemId: string;
	onItemConsumed: (itemId: string) => void;
	onMergeConsumed: (mergeId: string) => void;
}) {
	const [dialog, setDialog] = useState<"attach" | "convert" | null>(null);
	const [targetKind, setTargetKind] = useState<ConvertTargetKind>("work");
	const [targetId, setTargetId] = useState("");
	const [relation, setRelation] = useState<"evidence" | "origin">("origin");
	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.captureInbox.listAll.queryKey(),
		});
	}, []);
	const convert = useMutation(
		orpc.captureInbox.convert.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "needs-preview") {
					return;
				}
				if (outcome.status === "consumed") {
					onItemConsumed(itemId);
				}
				await invalidate();
				setDialog(null);
			},
		})
	);
	const attach = useMutation(
		orpc.captureInbox.attach.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "needs-preview") {
					return;
				}
				if (outcome.status === "consumed") {
					onItemConsumed(itemId);
					onMergeConsumed(outcome.mergeId);
				}
				await invalidate();
				setDialog(null);
			},
		})
	);
	const deleteItem = useMutation(
		orpc.captureInbox.deleteItem.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "consumed") {
					onItemConsumed(itemId);
				}
				await invalidate();
			},
		})
	);
	const onConvert = useCallback(() => {
		setDialog("convert");
	}, []);
	const onAttach = useCallback(() => {
		setDialog("attach");
	}, []);
	const onDelete = useCallback(() => {
		deleteItem.mutate({
			idempotencyKey: newIdempotencyKey(),
			itemId,
		});
	}, [deleteItem, itemId]);
	const onDialogOpenChange = useCallback((open: boolean) => {
		if (!open) {
			setDialog(null);
		}
	}, []);
	const onTargetKindChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setTargetKind(event.target.value as ConvertTargetKind);
		},
		[]
	);
	const onRelationChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setRelation(event.target.value as "evidence" | "origin");
		},
		[]
	);
	const confirmConvert = useCallback(() => {
		convert.mutate({
			idempotencyKey: newIdempotencyKey(),
			itemId,
			previewed: true,
			targetKind,
		});
	}, [convert, itemId, targetKind]);
	const confirmAttach = useCallback(() => {
		if (!targetId) {
			return;
		}
		attach.mutate({
			idempotencyKey: newIdempotencyKey(),
			itemId,
			previewed: true,
			relation,
			targetId,
		});
	}, [attach, itemId, relation, targetId]);

	return (
		<div className="mt-3 flex flex-wrap gap-2">
			<Button onClick={onConvert} type="button" variant="outline">
				{copy.convert}
			</Button>
			<Button onClick={onAttach} type="button" variant="outline">
				{copy.attachToExisting}
			</Button>
			<Button onClick={onDelete} type="button" variant="outline">
				{copy.delete}
			</Button>
			<ConvertDialog
				copy={copy}
				itemId={itemId}
				onConfirm={confirmConvert}
				onOpenChange={onDialogOpenChange}
				onTargetKindChange={onTargetKindChange}
				open={dialog === "convert"}
				targetKind={targetKind}
			/>
			<AttachDialog
				copy={copy}
				itemId={itemId}
				onConfirm={confirmAttach}
				onOpenChange={onDialogOpenChange}
				onRelationChange={onRelationChange}
				onTargetIdChange={setTargetId}
				open={dialog === "attach"}
				relation={relation}
				targetId={targetId}
			/>
		</div>
	);
}

export function CaptureMergeUndo({
	copy,
	mergeId,
	onCleared,
}: {
	copy: Pick<TriageCopy, "evidence" | "origin">;
	mergeId: string;
	onCleared: () => void;
}) {
	const [open, setOpen] = useState(false);
	const preview = useQuery({
		...orpc.captureInbox.previewUndoMerge.queryOptions({
			input: { mergeId },
		}),
		enabled: open,
	});
	const undo = useMutation(
		orpc.captureInbox.undoMerge.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.captureInbox.listAll.queryKey(),
				});
				setOpen(false);
				onCleared();
			},
		})
	);
	const onOpen = useCallback(() => {
		setOpen(true);
	}, []);
	const onOpenChange = useCallback((next: boolean) => {
		setOpen(next);
	}, []);
	const onConfirm = useCallback(() => {
		undo.mutate({
			idempotencyKey: newIdempotencyKey(),
			mergeId,
		});
	}, [mergeId, undo]);
	const previewData =
		preview.data && !isNotFound(preview.data) ? preview.data : null;
	const lines = previewData
		? mergeUndoPreviewLines({
				bindsToRemove: previewData.bindsToRemove,
				copy,
				restoredItem: previewData.restoredItem,
			})
		: [];

	return (
		<div className="flex flex-col gap-2">
			<Button onClick={onOpen} type="button" variant="outline">
				{MUTATION_COPY.undo}
			</Button>
			<Dialog onOpenChange={onOpenChange} open={open}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{MUTATION_COPY.undo}</DialogTitle>
					</DialogHeader>
					{lines.length > 0 ? (
						<div className="flex flex-col gap-2 text-sm">
							{lines.map((line) => (
								<p className="whitespace-pre-wrap" key={line.id}>
									{line.text}
								</p>
							))}
						</div>
					) : null}
					<DialogFooter>
						<Button onClick={onConfirm} type="button">
							{MUTATION_COPY.undo}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ConvertDialog({
	copy,
	itemId,
	onConfirm,
	onOpenChange,
	onTargetKindChange,
	open,
	targetKind,
}: {
	copy: TriageCopy;
	itemId: string;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	onTargetKindChange: (event: ChangeEvent<HTMLSelectElement>) => void;
	open: boolean;
	targetKind: ConvertTargetKind;
}) {
	const preview = useQuery({
		...orpc.captureInbox.previewConvert.queryOptions({
			input: { itemId, targetKind },
		}),
		enabled: open,
	});
	const previewData =
		preview.data && !isNotFound(preview.data) ? preview.data : null;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{copy.convert}</DialogTitle>
				</DialogHeader>
				<Field>
					<FieldLabel htmlFor={`convert-kind-${itemId}`}>
						{copy.convert}
					</FieldLabel>
					<NativeSelect
						id={`convert-kind-${itemId}`}
						onChange={onTargetKindChange}
						value={targetKind}
					>
						{convertTargetOptions(copy).map((option) => (
							<NativeSelectOption key={option.id} value={option.id}>
								{option.label}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				{previewData ? (
					<div className="flex flex-col gap-3 text-sm">
						<p className="whitespace-pre-wrap">{previewData.original.text}</p>
						{previewData.original.link ? (
							<p>{previewData.original.link}</p>
						) : null}
						{previewData.original.screenshot ? (
							<p>{previewData.original.screenshot}</p>
						) : null}
						<p>
							{previewData.proposed.label}
							{previewData.proposed.body
								? ` — ${previewData.proposed.body}`
								: ""}
						</p>
						{previewData.fieldMappings.map((mapping) => (
							<p key={`${mapping.sourceField}-${mapping.targetField}`}>
								{mapping.sourceField} → {mapping.targetField}: {mapping.value}
							</p>
						))}
					</div>
				) : null}
				<DialogFooter>
					<Button disabled={!previewData} onClick={onConfirm} type="button">
						{copy.convert}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function AttachDialog({
	copy,
	itemId,
	onConfirm,
	onOpenChange,
	onRelationChange,
	onTargetIdChange,
	open,
	relation,
	targetId,
}: {
	copy: TriageCopy;
	itemId: string;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	onRelationChange: (event: ChangeEvent<HTMLSelectElement>) => void;
	onTargetIdChange: (targetId: string) => void;
	open: boolean;
	relation: "evidence" | "origin";
	targetId: string;
}) {
	const suggestions = useQuery({
		...orpc.captureInbox.suggestSimilar.queryOptions({
			input: { itemId },
		}),
		enabled: open,
	});
	const preview = useQuery({
		...orpc.captureInbox.previewAttach.queryOptions({
			input: { itemId, relation, targetId },
		}),
		enabled: open && targetId !== "",
	});
	const suggestionData =
		suggestions.data && !isNotFound(suggestions.data) ? suggestions.data : null;
	const previewData =
		preview.data && !isNotFound(preview.data) ? preview.data : null;
	const otherGroups = otherProjectGroups(
		suggestionData?.otherProjects.matches ?? []
	);
	const onPick = useCallback(
		(id: string) => {
			onTargetIdChange(id);
		},
		[onTargetIdChange]
	);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{copy.attachToExisting}</DialogTitle>
				</DialogHeader>
				<Field>
					<FieldLabel htmlFor={`attach-relation-${itemId}`}>
						{copy.attachToExisting}
					</FieldLabel>
					<NativeSelect
						id={`attach-relation-${itemId}`}
						onChange={onRelationChange}
						value={relation}
					>
						<NativeSelectOption value="origin">
							{copy.origin}
						</NativeSelectOption>
						<NativeSelectOption value="evidence">
							{copy.evidence}
						</NativeSelectOption>
					</NativeSelect>
				</Field>
				{suggestionData ? (
					<div className="flex flex-col gap-3">
						<SuggestionList
							matches={suggestionData.primary}
							onPick={onPick}
							selectedId={targetId}
						/>
						{otherGroups.length > 0 ? (
							<section aria-label={copy.otherProjects}>
								<h3 className="font-medium text-sm">{copy.otherProjects}</h3>
								{otherGroups.map((group) => (
									<div className="mt-2" key={group.projectName}>
										<p className="text-muted-foreground text-xs">
											{group.projectName}
										</p>
										<SuggestionList
											matches={group.matches}
											onPick={onPick}
											selectedId={targetId}
										/>
									</div>
								))}
							</section>
						) : null}
					</div>
				) : null}
				{previewData ? (
					<div className="flex flex-col gap-1 text-sm">
						<p>{previewData.target.title}</p>
						<p>{previewData.target.projectName}</p>
						<p>
							{previewData.relation === "origin" ? copy.origin : copy.evidence}
						</p>
					</div>
				) : null}
				<DialogFooter>
					<Button disabled={!previewData} onClick={onConfirm} type="button">
						{copy.attachToExisting}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function SuggestionList({
	matches,
	onPick,
	selectedId,
}: {
	matches: Array<{
		basis: { excerpt: string; kind: string };
		id: string;
		title: string;
	}>;
	onPick: (id: string) => void;
	selectedId: string;
}) {
	if (matches.length === 0) {
		return null;
	}
	return (
		<ul className="flex flex-col gap-2">
			{matches.map((match) => (
				<SuggestionItem
					key={match.id}
					match={match}
					onPick={onPick}
					selected={selectedId === match.id}
				/>
			))}
		</ul>
	);
}

function SuggestionItem({
	match,
	onPick,
	selected,
}: {
	match: {
		basis: { excerpt: string; kind: string };
		id: string;
		title: string;
	};
	onPick: (id: string) => void;
	selected: boolean;
}) {
	const onClick = useCallback(() => {
		onPick(match.id);
	}, [match.id, onPick]);
	return (
		<li>
			<Button
				aria-pressed={selected}
				onClick={onClick}
				type="button"
				variant={selected ? "default" : "outline"}
			>
				<span className="flex flex-col items-start">
					<span>{match.title}</span>
					<span className="text-xs">{match.basis.excerpt}</span>
				</span>
			</Button>
		</li>
	);
}
