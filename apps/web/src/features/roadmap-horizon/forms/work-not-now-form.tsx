import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import { orpc } from "@/utils/orpc";

import NotNowMark from "../views/not-now-mark";
import { NOT_NOW_GROUND_KINDS, ROADMAP_COPY } from "../views/roadmap-copy";

type GroundKind = (typeof NOT_NOW_GROUND_KINDS)[number];
interface Ground {
	id: string;
	kind: GroundKind;
}
type ReviewLaterEffect =
	| typeof ROADMAP_COPY.keepReviewLater
	| typeof ROADMAP_COPY.removeReviewLater;

export default function WorkNotNowForm({
	onOpenSourceRecord,
	projectId,
	workId,
	workStatus,
}: {
	onOpenSourceRecord?: (id: string) => void;
	projectId: string;
	workId: string;
	workStatus: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [reason, setReason] = useState("");
	const [condition, setCondition] = useState("");
	const [groundKind, setGroundKind] = useState<GroundKind>("Decision");
	const [groundId, setGroundId] = useState("");
	const [grounds, setGrounds] = useState<Ground[]>([]);
	const [reviewLaterEffect, setReviewLaterEffect] = useState<ReviewLaterEffect>(
		ROADMAP_COPY.keepReviewLater
	);
	const trail = useQuery(
		orpc.roadmapHorizon.notNow.queryOptions({
			input: { workId },
		})
	);
	const draft = useMemo(
		() => ({
			grounds,
			reason,
			reevaluationCondition: condition.trim().length > 0 ? condition : null,
			reviewLaterEffect,
			workId,
		}),
		[condition, grounds, reason, reviewLaterEffect, workId]
	);
	const preview = useQuery({
		...orpc.roadmapHorizon.previewNotNow.queryOptions({
			input: draft,
		}),
		enabled: reason.trim().length > 0,
	});
	const reconsiderPreview = useQuery({
		...orpc.roadmapHorizon.previewReconsiderNotNow.queryOptions({
			input: { reviewLaterEffect, workId },
		}),
		enabled: trail.data?.active !== null && trail.data?.active !== undefined,
	});
	const apply = useMutation(
		orpc.roadmapHorizon.applyNotNow.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status !== "committed") {
					setError("Conflict");
					return;
				}
				await invalidateWork(projectId, workId);
				recordSave();
				setError(null);
				setReason("");
				setCondition("");
				setGrounds([]);
			},
		})
	);
	const reconsider = useMutation(
		orpc.roadmapHorizon.reconsiderNotNow.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status !== "committed") {
					setError("Conflict");
					return;
				}
				await invalidateWork(projectId, workId);
				recordSave();
				setError(null);
			},
		})
	);
	const onAddGround = useCallback(() => {
		const id = groundId.trim();
		if (id.length === 0) {
			return;
		}
		markUnsaved();
		setGrounds((current) => [...current, { id, kind: groundKind }]);
		setGroundId("");
	}, [groundId, groundKind, markUnsaved]);
	const onReasonChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			markUnsaved();
			setReason(event.currentTarget.value);
		},
		[markUnsaved]
	);
	const onConditionChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			markUnsaved();
			setCondition(event.currentTarget.value);
		},
		[markUnsaved]
	);
	const onGroundKindChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setGroundKind(event.currentTarget.value as GroundKind);
		},
		[]
	);
	const onGroundIdChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setGroundId(event.currentTarget.value);
		},
		[]
	);
	const onApply = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!preview.data) {
				return;
			}
			setError(null);
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				apply.mutateAsync({
					grounds,
					previewAcknowledged: true,
					reason,
					reevaluationCondition: condition.trim().length > 0 ? condition : null,
					reviewLaterEffect,
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[
			apply,
			attemptOnlineWork,
			condition,
			grounds,
			markUnsaved,
			preview.data,
			reason,
			reviewLaterEffect,
			workId,
		]
	);
	const onReconsider = useCallback(() => {
		if (!reconsiderPreview.data) {
			return;
		}
		setError(null);
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			reconsider.mutateAsync({
				previewAcknowledged: true,
				reviewLaterEffect,
				workId,
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [
		attemptOnlineWork,
		markUnsaved,
		reconsider,
		reconsiderPreview.data,
		reviewLaterEffect,
		workId,
	]);
	const active = trail.data?.active ?? null;
	const history = trail.data?.history ?? [];
	const showReviewLater = (trail.data?.reviewLater.ids ?? []).length > 0;
	return (
		<section aria-label={ROADMAP_COPY.notNow} className="flex flex-col gap-3">
			<div className="flex items-start justify-between gap-3">
				<h3 className="font-medium text-sm tracking-tight">
					{ROADMAP_COPY.notNow}
				</h3>
				<NotNowMark reason={active?.reason} />
			</div>
			<ActiveTrailSummary
				active={active}
				onOpenSourceRecord={onOpenSourceRecord}
			/>
			<ClosedTrailHistory history={history} />
			{workStatus === "Closed" ? null : (
				<ApplyNotNowFields
					condition={condition}
					groundId={groundId}
					groundKind={groundKind}
					grounds={grounds}
					onAddGround={onAddGround}
					onApply={onApply}
					onConditionChange={onConditionChange}
					onGroundIdChange={onGroundIdChange}
					onGroundKindChange={onGroundKindChange}
					onOpenSourceRecord={onOpenSourceRecord}
					onReasonChange={onReasonChange}
					onReviewLaterEffectChange={setReviewLaterEffect}
					preview={preview.data}
					reason={reason}
					reviewLaterEffect={reviewLaterEffect}
					showReviewLater={showReviewLater}
					workId={workId}
				/>
			)}
			{active ? (
				<ReconsiderNotNowPanel
					onOpenSourceRecord={onOpenSourceRecord}
					onReconsider={onReconsider}
					onReviewLaterEffectChange={setReviewLaterEffect}
					preview={reconsiderPreview.data}
					reviewLaterEffect={reviewLaterEffect}
					showReviewLater={showReviewLater}
					workId={workId}
				/>
			) : null}
			{error ? <p className="text-destructive text-sm">{error}</p> : null}
		</section>
	);
}

function ActiveTrailSummary({
	active,
	onOpenSourceRecord,
}: {
	active: {
		grounds: Ground[];
		reason: string;
		reevaluationCondition: string | null;
	} | null;
	onOpenSourceRecord?: (id: string) => void;
}) {
	if (!active) {
		return (
			<p className="text-muted-foreground text-sm">{ROADMAP_COPY.notNow}</p>
		);
	}
	return (
		<div className="flex flex-col gap-1 text-sm">
			<p>
				{ROADMAP_COPY.notNow}: {active.reason}
				{active.reevaluationCondition
					? ` · ${active.reevaluationCondition}`
					: ""}
			</p>
			<GroundsList
				grounds={active.grounds}
				onOpenSourceRecord={onOpenSourceRecord}
			/>
		</div>
	);
}

function ClosedTrailHistory({
	history,
}: {
	history: Array<{ closeAction: string | null; id: string; reason: string }>;
}) {
	if (history.length === 0) {
		return null;
	}
	return (
		<ul className="flex flex-col gap-1 text-muted-foreground text-xs">
			{history.map((entry) => (
				<li key={entry.id}>
					{entry.reason}
					{entry.closeAction ? ` · ${entry.closeAction}` : ""}
				</li>
			))}
		</ul>
	);
}

function ApplyNotNowFields({
	condition,
	groundId,
	groundKind,
	grounds,
	onAddGround,
	onApply,
	onConditionChange,
	onGroundIdChange,
	onGroundKindChange,
	onOpenSourceRecord,
	onReasonChange,
	onReviewLaterEffectChange,
	preview,
	reason,
	reviewLaterEffect,
	showReviewLater,
	workId,
}: {
	condition: string;
	groundId: string;
	groundKind: GroundKind;
	grounds: Ground[];
	onAddGround: () => void;
	onApply: (event: FormEvent<HTMLFormElement>) => void;
	onConditionChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
	onGroundIdChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onGroundKindChange: (event: ChangeEvent<HTMLSelectElement>) => void;
	onOpenSourceRecord?: (id: string) => void;
	onReasonChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
	onReviewLaterEffectChange: (value: ReviewLaterEffect) => void;
	preview:
		| {
				grounds: Ground[];
				reason: string;
				reevaluationCondition: string | null;
				reviewLater: { effect: string };
		  }
		| undefined;
	reason: string;
	reviewLaterEffect: ReviewLaterEffect;
	showReviewLater: boolean;
	workId: string;
}) {
	return (
		<form className="flex flex-col gap-3" onSubmit={onApply}>
			<Field>
				<FieldLabel htmlFor={`${workId}-not-now-reason`}>
					{ROADMAP_COPY.reason}
				</FieldLabel>
				<Textarea
					id={`${workId}-not-now-reason`}
					onChange={onReasonChange}
					value={reason}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={`${workId}-not-now-condition`}>
					{ROADMAP_COPY.reevaluationCondition}
				</FieldLabel>
				<Textarea
					id={`${workId}-not-now-condition`}
					onChange={onConditionChange}
					value={condition}
				/>
			</Field>
			<div className="flex flex-wrap items-end gap-2">
				<Field>
					<FieldLabel htmlFor={`${workId}-not-now-ground-kind`}>
						{ROADMAP_COPY.grounds}
					</FieldLabel>
					<NativeSelect
						id={`${workId}-not-now-ground-kind`}
						onChange={onGroundKindChange}
						value={groundKind}
					>
						{NOT_NOW_GROUND_KINDS.map((kind) => (
							<NativeSelectOption key={kind} value={kind}>
								{kind}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${workId}-not-now-ground-id`}>
						{ROADMAP_COPY.grounds}
					</FieldLabel>
					<Input
						id={`${workId}-not-now-ground-id`}
						onChange={onGroundIdChange}
						value={groundId}
					/>
				</Field>
				<Button onClick={onAddGround} size="sm" type="button">
					{ROADMAP_COPY.grounds}
				</Button>
			</div>
			<GroundsList grounds={grounds} onOpenSourceRecord={onOpenSourceRecord} />
			<NotNowPreviewCard
				onOpenSourceRecord={onOpenSourceRecord}
				preview={preview}
				showReviewLater={showReviewLater}
			/>
			{showReviewLater ? (
				<ReviewLaterEffectField
					id={`${workId}-not-now-review-later`}
					onChange={onReviewLaterEffectChange}
					value={reviewLaterEffect}
				/>
			) : null}
			<Button disabled={!preview} size="sm" type="submit">
				{ROADMAP_COPY.applyNotNow}
			</Button>
		</form>
	);
}

function ReconsiderNotNowPanel({
	onOpenSourceRecord,
	onReconsider,
	onReviewLaterEffectChange,
	preview,
	reviewLaterEffect,
	showReviewLater,
	workId,
}: {
	onOpenSourceRecord?: (id: string) => void;
	onReconsider: () => void;
	onReviewLaterEffectChange: (value: ReviewLaterEffect) => void;
	preview:
		| {
				grounds: Ground[];
				reason: string;
				reviewLater: { effect: string };
		  }
		| undefined;
	reviewLaterEffect: ReviewLaterEffect;
	showReviewLater: boolean;
	workId: string;
}) {
	return (
		<div className="flex flex-col gap-2">
			<NotNowPreviewCard
				onOpenSourceRecord={onOpenSourceRecord}
				preview={preview}
				showReviewLater={showReviewLater}
			/>
			{showReviewLater ? (
				<ReviewLaterEffectField
					id={`${workId}-reconsider-review-later`}
					onChange={onReviewLaterEffectChange}
					value={reviewLaterEffect}
				/>
			) : null}
			<Button
				disabled={!preview}
				onClick={onReconsider}
				size="sm"
				type="button"
			>
				{ROADMAP_COPY.reconsidering}
			</Button>
		</div>
	);
}

function NotNowPreviewCard({
	onOpenSourceRecord,
	preview,
	showReviewLater,
}: {
	onOpenSourceRecord?: (id: string) => void;
	preview:
		| {
				grounds: Ground[];
				reason: string;
				reevaluationCondition?: string | null;
				reviewLater: { effect: string };
		  }
		| undefined;
	showReviewLater: boolean;
}) {
	if (!preview) {
		return null;
	}
	return (
		<div className="border px-3 py-2 text-sm">
			<p>
				{ROADMAP_COPY.preview}: {preview.reason}
			</p>
			{preview.reevaluationCondition ? (
				<p>
					{ROADMAP_COPY.reevaluationCondition}: {preview.reevaluationCondition}
				</p>
			) : null}
			<GroundsList
				grounds={preview.grounds}
				onOpenSourceRecord={onOpenSourceRecord}
			/>
			{showReviewLater ? (
				<p>
					{ROADMAP_COPY.reviewLater}: {preview.reviewLater.effect}
				</p>
			) : null}
		</div>
	);
}

function GroundsList({
	grounds,
	onOpenSourceRecord,
}: {
	grounds: Ground[];
	onOpenSourceRecord?: (id: string) => void;
}) {
	if (grounds.length === 0) {
		return null;
	}
	return (
		<ul className="flex flex-col gap-1 text-muted-foreground text-xs">
			{grounds.map((ground) => (
				<GroundRow
					ground={ground}
					key={`${ground.kind}:${ground.id}`}
					onOpenSourceRecord={onOpenSourceRecord}
				/>
			))}
		</ul>
	);
}

function GroundRow({
	ground,
	onOpenSourceRecord,
}: {
	ground: Ground;
	onOpenSourceRecord?: (id: string) => void;
}) {
	const onOpen = useCallback(() => {
		onOpenSourceRecord?.(ground.id);
	}, [ground.id, onOpenSourceRecord]);
	return (
		<li className="flex flex-wrap items-baseline gap-2">
			<span>
				{ROADMAP_COPY.grounds}: {ground.kind}
			</span>
			<button
				className="underline-offset-2 hover:underline"
				onClick={onOpen}
				type="button"
			>
				{ROADMAP_COPY.openSourceRecord}
			</button>
		</li>
	);
}

function ReviewLaterEffectField({
	id,
	onChange,
	value,
}: {
	id: string;
	onChange: (value: ReviewLaterEffect) => void;
	value: ReviewLaterEffect;
}) {
	const onSelectChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const next = event.currentTarget.value;
			if (
				next === ROADMAP_COPY.keepReviewLater ||
				next === ROADMAP_COPY.removeReviewLater
			) {
				onChange(next);
			}
		},
		[onChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor={id}>{ROADMAP_COPY.reviewLater}</FieldLabel>
			<NativeSelect id={id} onChange={onSelectChange} value={value}>
				<NativeSelectOption value={ROADMAP_COPY.keepReviewLater}>
					{ROADMAP_COPY.keepReviewLater}
				</NativeSelectOption>
				<NativeSelectOption value={ROADMAP_COPY.removeReviewLater}>
					{ROADMAP_COPY.removeReviewLater}
				</NativeSelectOption>
			</NativeSelect>
		</Field>
	);
}
