import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { createPriorityCriterionError } from "../forms/create-priority-criterion-error";
import {
	PRIORITY_COPY,
	PRIORITY_RANKS,
	type PriorityRank,
} from "../forms/priority-copy";

export default function PriorityMap({
	onSelectWork,
	projectId,
	selectedWorkId,
}: {
	onSelectWork: (workId: string) => void;
	projectId: string;
	selectedWorkId: string | null;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const criteria = useQuery(
		orpc.priority.list.queryOptions({ input: { projectId } })
	);
	const saved = useQuery(
		orpc.priority.presentation.queryOptions({ input: { projectId } })
	);
	const [horizontalId, setHorizontalId] = useState("");
	const [verticalId, setVerticalId] = useState("");
	const enabled = (criteria.data ?? []).filter((item) => item.enabled);
	const axesReady =
		horizontalId.length > 0 &&
		verticalId.length > 0 &&
		horizontalId !== verticalId;
	const map = useQuery({
		...orpc.priority.map.queryOptions({
			input: {
				horizontalCriterionId: horizontalId,
				projectId,
				verticalCriterionId: verticalId,
			},
		}),
		enabled: axesReady,
	});
	const saveMap = useMutation(orpc.priority.saveMap.mutationOptions());

	useEffect(() => {
		if (!saved.data) {
			return;
		}
		setHorizontalId(saved.data.horizontalCriterionId);
		setVerticalId(saved.data.verticalCriterionId);
	}, [saved.data]);

	const onHorizontal = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setHorizontalId(event.target.value);
	}, []);
	const onVertical = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setVerticalId(event.target.value);
	}, []);
	const onSave = useCallback(async () => {
		if (!axesReady) {
			return;
		}
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			saveMap.mutateAsync({
				idempotencyKey: newIdempotencyKey(),
				payload: {
					horizontalCriterionId: horizontalId,
					projectId,
					verticalCriterionId: verticalId,
				},
			})
		);
		if (result.status === "refused") {
			return;
		}
		await result.value;
		await queryClient.invalidateQueries({
			queryKey: orpc.priority.presentation.queryKey({
				input: { projectId },
			}),
		});
		recordSave();
	}, [
		attemptOnlineWork,
		axesReady,
		horizontalId,
		markUnsaved,
		projectId,
		recordSave,
		saveMap,
		verticalId,
	]);
	const onClickSave = useCallback(() => {
		onSave().catch(() => undefined);
	}, [onSave]);
	const onSelect = useCallback(
		(workId: string) => {
			onSelectWork(workId);
		},
		[onSelectWork]
	);

	if (criteria.isPending || saved.isPending) {
		return <p>{PRIORITY_COPY.priorityMap}</p>;
	}

	const view = map.data?.status === "ok" ? map.data.view : null;
	const verticalRanks = [...PRIORITY_RANKS].reverse();

	return (
		<section
			aria-label={PRIORITY_COPY.priorityMap}
			className="flex flex-col gap-4"
		>
			<h2 className="font-medium text-sm">{PRIORITY_COPY.priorityMap}</h2>
			<div className="flex flex-wrap items-end gap-3">
				<Field>
					<FieldLabel htmlFor="priority-map-horizontal">
						{PRIORITY_COPY.horizontal}
					</FieldLabel>
					<NativeSelect
						id="priority-map-horizontal"
						onChange={onHorizontal}
						value={horizontalId}
					>
						<NativeSelectOption value="">
							{PRIORITY_COPY.horizontal}
						</NativeSelectOption>
						{enabled.map((item) => (
							<NativeSelectOption key={item.id} value={item.id}>
								{item.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor="priority-map-vertical">
						{PRIORITY_COPY.vertical}
					</FieldLabel>
					<NativeSelect
						id="priority-map-vertical"
						onChange={onVertical}
						value={verticalId}
					>
						<NativeSelectOption value="">
							{PRIORITY_COPY.vertical}
						</NativeSelectOption>
						{enabled.map((item) => (
							<NativeSelectOption key={item.id} value={item.id}>
								{item.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Button onClick={onClickSave} size="sm" type="button">
					{PRIORITY_COPY.save}
				</Button>
			</div>
			{view ? (
				<div className="overflow-x-auto">
					<table className="w-full border-collapse text-xs">
						<caption className="sr-only">{PRIORITY_COPY.priorityMap}</caption>
						<thead>
							<tr>
								<th className="border px-2 py-1 text-left">
									{view.vertical.name}
								</th>
								{PRIORITY_RANKS.map((rank) => (
									<th className="border px-2 py-1" key={rank} scope="col">
										{rank}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{verticalRanks.map((verticalRank) => (
								<tr key={verticalRank}>
									<th className="border px-2 py-1 text-left" scope="row">
										{verticalRank}
									</th>
									{PRIORITY_RANKS.map((horizontalRank) => {
										const points = view.plotted.filter(
											(point) =>
												point.horizontalRank === horizontalRank &&
												point.verticalRank === verticalRank
										);
										return (
											<td className="border p-1 align-top" key={horizontalRank}>
												<ul className="flex flex-col gap-1">
													{points.map((point) => (
														<li key={point.workId}>
															<MapPoint
																onSelect={onSelect}
																point={point}
																selected={point.workId === selectedWorkId}
															/>
														</li>
													))}
												</ul>
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}
			<section aria-label={PRIORITY_COPY.unevaluated}>
				<h3 className="font-medium text-sm">{PRIORITY_COPY.unevaluated}</h3>
				<ul className="mt-2 flex flex-col">
					{(view?.unevaluated ?? []).map((point) => (
						<li key={point.workId}>
							<MapPoint
								onSelect={onSelect}
								point={point}
								selected={point.workId === selectedWorkId}
							/>
						</li>
					))}
				</ul>
			</section>
			{selectedWorkId && axesReady ? (
				<MapAxisEditor
					horizontalCriterionId={horizontalId}
					horizontalName={view?.horizontal.name ?? PRIORITY_COPY.horizontal}
					projectId={projectId}
					verticalCriterionId={verticalId}
					verticalName={view?.vertical.name ?? PRIORITY_COPY.vertical}
					workId={selectedWorkId}
				/>
			) : null}
		</section>
	);
}

function MapAxisEditor({
	horizontalCriterionId,
	horizontalName,
	projectId,
	verticalCriterionId,
	verticalName,
	workId,
}: {
	horizontalCriterionId: string;
	horizontalName: string;
	projectId: string;
	verticalCriterionId: string;
	verticalName: string;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [ranks, setRanks] = useState<Record<string, PriorityRank | null>>({});
	const values = useQuery(
		orpc.priority.workValues.queryOptions({
			input: { projectId, workId },
		})
	);
	const setValue = useMutation(orpc.priority.setValue.mutationOptions());

	useEffect(() => {
		if (!values.data) {
			return;
		}
		setRanks(
			Object.fromEntries(
				values.data
					.filter(
						(item) =>
							item.criterionId === horizontalCriterionId ||
							item.criterionId === verticalCriterionId
					)
					.map((item) => [item.criterionId, item.rank])
			)
		);
	}, [horizontalCriterionId, values.data, verticalCriterionId]);

	const onSave = useCallback(async () => {
		if (!values.data) {
			return;
		}
		setError(null);
		markUnsaved();
		const outcomes = await Promise.all(
			values.data
				.filter(
					(item) =>
						item.criterionId === horizontalCriterionId ||
						item.criterionId === verticalCriterionId
				)
				.map(async (item) => {
					const rank = ranks[item.criterionId] ?? null;
					const result = attemptOnlineWork("record-create", () =>
						setValue.mutateAsync({
							baseRevision: item.revision,
							idempotencyKey: newIdempotencyKey(),
							payload: {
								criterionId: item.criterionId,
								rank,
								workId,
							},
						})
					);
					if (result.status === "refused") {
						return { reason: "offline", status: "rejected" as const };
					}
					return await result.value;
				})
		);
		for (const outcome of outcomes) {
			if (outcome.status === "committed" || outcome.status === "replayed") {
				continue;
			}
			if (outcome.status === "rejected" && outcome.reason === "offline") {
				return;
			}
			const message = createPriorityCriterionError(outcome);
			if (message) {
				setError(message);
				return;
			}
		}
		await queryClient.invalidateQueries({
			queryKey: orpc.priority.workValues.queryKey({
				input: { projectId, workId },
			}),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.priority.map.queryKey({
				input: {
					horizontalCriterionId,
					projectId,
					verticalCriterionId,
				},
			}),
		});
		recordSave();
	}, [
		attemptOnlineWork,
		horizontalCriterionId,
		markUnsaved,
		projectId,
		ranks,
		recordSave,
		setValue,
		values.data,
		verticalCriterionId,
		workId,
	]);
	const onClickSave = useCallback(() => {
		onSave().catch(() => undefined);
	}, [onSave]);

	return (
		<section aria-label={PRIORITY_COPY.priorityMetrics}>
			<h3 className="font-medium text-sm">{PRIORITY_COPY.priorityMetrics}</h3>
			<ul className="mt-3 flex flex-col gap-3">
				<WorkRankField
					criterionId={horizontalCriterionId}
					name={horizontalName}
					onRankChange={setRanks}
					rank={ranks[horizontalCriterionId] ?? null}
				/>
				<WorkRankField
					criterionId={verticalCriterionId}
					name={verticalName}
					onRankChange={setRanks}
					rank={ranks[verticalCriterionId] ?? null}
				/>
			</ul>
			<Button className="mt-3" onClick={onClickSave} size="sm" type="button">
				{PRIORITY_COPY.save}
			</Button>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}

function WorkRankField({
	criterionId,
	name,
	onRankChange,
	rank,
}: {
	criterionId: string;
	name: string;
	onRankChange: (
		update: (
			current: Record<string, PriorityRank | null>
		) => Record<string, PriorityRank | null>
	) => void;
	rank: PriorityRank | null;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const next = event.target.value;
			onRankChange((current) => ({
				...current,
				[criterionId]: next === "" ? null : (next as PriorityRank),
			}));
		},
		[criterionId, onRankChange]
	);
	return (
		<li>
			<Field>
				<FieldLabel htmlFor={`priority-map-value-${criterionId}`}>
					{name}
				</FieldLabel>
				<NativeSelect
					className="w-full"
					id={`priority-map-value-${criterionId}`}
					onChange={onChange}
					value={rank ?? ""}
				>
					<NativeSelectOption value="">
						{PRIORITY_COPY.unevaluated}
					</NativeSelectOption>
					{PRIORITY_RANKS.map((option) => (
						<NativeSelectOption key={option} value={option}>
							{option}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
		</li>
	);
}

function MapPoint({
	onSelect,
	point,
	selected,
}: {
	onSelect: (workId: string) => void;
	point: {
		evidence: {
			feedbackCount: number;
			uniqueCompanyCount: number;
			uniqueContactCount: number;
		} | null;
		key: string;
		title: string;
		workId: string;
	};
	selected: boolean;
}) {
	const onClick = useCallback(() => {
		onSelect(point.workId);
	}, [onSelect, point.workId]);
	return (
		<button
			aria-pressed={selected}
			className="w-full px-2 py-1 text-left text-sm hover:bg-muted/70"
			onClick={onClick}
			type="button"
		>
			<span className="font-mono text-muted-foreground text-xs">
				{point.key}
			</span>{" "}
			{point.title}
			{point.evidence ? (
				<span className="block text-muted-foreground text-xs">
					{PRIORITY_COPY.feedback} {point.evidence.feedbackCount}
					{" · "}
					{PRIORITY_COPY.uniqueContact} {point.evidence.uniqueContactCount}
					{" · "}
					{PRIORITY_COPY.uniqueCompany} {point.evidence.uniqueCompanyCount}
				</span>
			) : null}
		</button>
	);
}
