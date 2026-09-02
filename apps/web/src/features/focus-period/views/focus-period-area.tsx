import { CLIENT_SHELL_COPY as MAIN_FLOW_COPY } from "@cantiara/api/client-shell-failure";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { FOCUS_PERIOD_COPY } from "./focus-period-copy";

interface FocusPeriodWork {
	id: string;
	key: string;
	projectId: string;
	projectName: string;
	title: string;
}

interface DestinationPeriod {
	endDate: string;
	id: string;
	purpose: string;
	startDate: string;
	status: string;
}

interface StillOpenWork {
	autoRollover: boolean;
	destinations: {
		anotherPeriod: DestinationPeriod[];
		nextPeriod: DestinationPeriod | null;
	};
	opened: boolean;
	stillOpen: FocusPeriodWork[];
}

interface CloseComparison {
	addedLater: FocusPeriodWork[];
	completed: FocusPeriodWork[];
	inStartSnapshot: FocusPeriodWork[];
	removed: FocusPeriodWork[];
	stillOpen: FocusPeriodWork[];
}

interface DateComparison {
	completedAfter: FocusPeriodWork[];
	completedOnTarget: FocusPeriodWork[];
	movedEarlier: FocusPeriodWork[];
	movedLater: FocusPeriodWork[];
	stillOpen: FocusPeriodWork[];
}

interface PeriodEvaluation {
	change: string;
	followUpWork: FocusPeriodWork[];
	keep: string;
	skipped: boolean;
	tryNext: string;
}

interface EligibleWork {
	activePeriodId: string | null;
	id: string;
	key: string;
	projectId: string;
	projectName: string;
	title: string;
}

interface FocusPeriodDependencyNode {
	href: string;
	id: string;
	kind: string;
	label: string;
	openSourceRecord: string;
}

interface FocusPeriodDependencyEdge {
	direction: string;
	from: { id: string; kind: string };
	id: string;
	state: string;
	to: { id: string };
}

interface FocusPeriodDependencies {
	copy: {
		blockedBy: string;
		blocks: string;
		cycle: string;
		dependencies: string;
	};
	cycles: Array<{
		explanation: string;
		relationIds: string[];
		workIds: string[];
	}>;
	edges: FocusPeriodDependencyEdge[];
	nodes: FocusPeriodDependencyNode[];
}

interface FocusPeriodSummary {
	endDate: string;
	id: string;
	purpose: string;
	startDate: string;
	status: string;
}

function workHref(work: FocusPeriodWork): string {
	return `/projects/${work.projectId}?work=${encodeURIComponent(work.id)}#work`;
}

export default function FocusPeriodArea() {
	const { attemptOnlineWork, markUnsaved } = useClientShell();
	const catalog = useQuery(orpc.focusPeriod.catalog.queryOptions());
	const list = useQuery(orpc.focusPeriod.list.queryOptions());
	const [selectedId, setSelectedId] = useState<string | undefined>();
	const copy = catalog.data?.copy ?? FOCUS_PERIOD_COPY;
	const periods = list.data ?? [];
	const periodId = selectedId ?? periods[0]?.id;
	const detail = useQuery({
		...orpc.focusPeriod.get.queryOptions({
			input: { periodId: periodId ?? "" },
		}),
		enabled: Boolean(periodId),
	});
	const invalidate = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: orpc.focusPeriod.list.queryKey(),
			}),
			queryClient.invalidateQueries({
				predicate: (query) =>
					JSON.stringify(query.queryKey).includes("focusPeriod"),
			}),
		]);
	}, []);
	const create = useMutation(
		orpc.focusPeriod.create.mutationOptions({
			onSuccess: invalidate,
		})
	);
	const add = useMutation(
		orpc.focusPeriod.add.mutationOptions({
			onSuccess: invalidate,
		})
	);
	const move = useMutation(
		orpc.focusPeriod.move.mutationOptions({
			onSuccess: invalidate,
		})
	);
	const remove = useMutation(
		orpc.focusPeriod.remove.mutationOptions({
			onSuccess: invalidate,
		})
	);
	const close = useMutation(
		orpc.focusPeriod.close.mutationOptions({
			onSuccess: invalidate,
		})
	);
	const cancel = useMutation(
		orpc.focusPeriod.cancel.mutationOptions({
			onSuccess: invalidate,
		})
	);
	const onCreate = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const form = event.currentTarget;
			const data = new FormData(form);
			const purpose = String(data.get("purpose") ?? "").trim();
			const startDate = String(data.get("startDate") ?? "");
			const endDate = String(data.get("endDate") ?? "");
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					endDate,
					idempotencyKey: newIdempotencyKey(),
					purpose,
					startDate,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value
				.then((outcome) => {
					if (outcome.status === "committed") {
						setSelectedId(outcome.period.id);
						form.reset();
					}
				})
				.catch(() => undefined);
		},
		[attemptOnlineWork, create, markUnsaved]
	);
	const onAdd = useCallback(
		(workId: string) => {
			if (!periodId) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				add.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					periodId,
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[add, attemptOnlineWork, markUnsaved, periodId]
	);
	const onMove = useCallback(
		(workId: string) => {
			if (!periodId) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				move.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					periodId,
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, markUnsaved, move, periodId]
	);
	const onRemove = useCallback(
		(workId: string) => {
			if (!periodId) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				remove.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					periodId,
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, markUnsaved, periodId, remove]
	);
	const onClose = useCallback(() => {
		if (!periodId) {
			return;
		}
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			close.mutateAsync({
				idempotencyKey: newIdempotencyKey(),
				periodId,
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [attemptOnlineWork, close, markUnsaved, periodId]);
	const onCancel = useCallback(() => {
		if (!periodId) {
			return;
		}
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			cancel.mutateAsync({
				idempotencyKey: newIdempotencyKey(),
				periodId,
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [attemptOnlineWork, cancel, markUnsaved, periodId]);
	const period = detail.data;
	const live =
		period?.status === copy.planned || period?.status === copy.active;
	const onSelectPeriod = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setSelectedId(event.target.value);
		},
		[]
	);

	return (
		<FounderPage title={copy.focusPeriod} wide>
			<form className="mb-8 grid gap-4" onSubmit={onCreate}>
				<Field>
					<FieldLabel htmlFor="focus-period-purpose">{copy.purpose}</FieldLabel>
					<Input id="focus-period-purpose" name="purpose" required />
				</Field>
				<Field>
					<FieldLabel htmlFor="focus-period-start">{copy.startDate}</FieldLabel>
					<Input
						id="focus-period-start"
						name="startDate"
						required
						type="date"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="focus-period-end">{copy.endDate}</FieldLabel>
					<Input id="focus-period-end" name="endDate" required type="date" />
				</Field>
				<Button type="submit">{copy.create}</Button>
				{create.data?.status === "invalid" ? <p>{create.data.reason}</p> : null}
			</form>
			{list.isError ? <p>{MAIN_FLOW_COPY.failed}</p> : null}
			{list.isPending && list.data === undefined ? <p>{copy.loading}</p> : null}
			{periods.length === 0 && !list.isPending ? <p>{copy.empty}</p> : null}
			{periods.length > 0 ? (
				<Field>
					<FieldLabel htmlFor="focus-period-select">
						{copy.focusPeriod}
					</FieldLabel>
					<NativeSelect
						id="focus-period-select"
						onChange={onSelectPeriod}
						value={periodId ?? ""}
					>
						{periods.map((row: FocusPeriodSummary) => (
							<NativeSelectOption key={row.id} value={row.id}>
								{`${row.purpose} (${row.status})`}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			) : null}
			{period ? (
				<section aria-labelledby="focus-period-detail" className="mt-8">
					<h2 id="focus-period-detail">
						{`${period.purpose} — ${period.status}`}
					</h2>
					<p>
						{`${copy.startDate} ${period.startDate} · ${copy.endDate} ${period.endDate}`}
					</p>
					<PeriodActions
						canCancel={live}
						canClose={period.status === copy.active}
						copy={copy}
						onCancel={onCancel}
						onClose={onClose}
					/>
					<PeriodClosePanels copy={copy} period={period} periodId={period.id} />
					{live ? (
						<EligibleWork
							copy={copy}
							eligible={period.eligibleWork}
							onAdd={onAdd}
							onMove={onMove}
						/>
					) : null}
					{add.data?.status === "invalid" ? <p>{add.data.reason}</p> : null}
					<section aria-labelledby="focus-period-members" className="mt-6">
						<h3 id="focus-period-members">{copy.members}</h3>
						<ul>
							{period.members.map((work: FocusPeriodWork) => (
								<MemberRow
									copy={copy}
									key={work.id}
									live={live}
									onRemove={onRemove}
									work={work}
								/>
							))}
						</ul>
					</section>
					<DependenciesPanel dependencies={period.dependencies} />
				</section>
			) : null}
		</FounderPage>
	);
}

function DependenciesPanel({
	dependencies,
}: {
	dependencies: FocusPeriodDependencies;
}) {
	return (
		<details className="mt-6">
			<summary>{dependencies.copy.dependencies}</summary>
			<p>{`${dependencies.copy.blocks} / ${dependencies.copy.blockedBy}`}</p>
			{dependencies.cycles.map((cycle) => (
				<p key={cycle.relationIds.join("-")}>{cycle.explanation}</p>
			))}
			<ul>
				{dependencies.nodes.map((node) => (
					<li key={`${node.kind}-${node.id}`}>
						<span>{`${node.label} (${node.kind})`}</span>{" "}
						<a href={node.href}>{node.openSourceRecord}</a>
					</li>
				))}
			</ul>
			<ul>
				{dependencies.edges.map((edge) => {
					const from =
						dependencies.nodes.find((node) => node.id === edge.from.id)
							?.label ?? edge.from.kind;
					const to =
						dependencies.nodes.find((node) => node.id === edge.to.id)?.label ??
						edge.to.id;
					return (
						<li key={edge.id}>
							{`${from} ${edge.direction} ${to} — ${edge.state}`}
						</li>
					);
				})}
			</ul>
		</details>
	);
}

function PeriodActions({
	canCancel,
	canClose,
	copy,
	onCancel,
	onClose,
}: {
	canCancel: boolean;
	canClose: boolean;
	copy: typeof FOCUS_PERIOD_COPY;
	onCancel: () => void;
	onClose: () => void;
}) {
	if (!(canCancel || canClose)) {
		return null;
	}
	return (
		<div className="mt-4 flex gap-2">
			{canClose ? (
				<Button onClick={onClose} type="button">
					{copy.close}
				</Button>
			) : null}
			{canCancel ? (
				<Button onClick={onCancel} type="button" variant="outline">
					{copy.cancel}
				</Button>
			) : null}
		</div>
	);
}

function EligibleWork({
	copy,
	eligible,
	onAdd,
	onMove,
}: {
	copy: typeof FOCUS_PERIOD_COPY;
	eligible: readonly EligibleWork[];
	onAdd: (workId: string) => void;
	onMove: (workId: string) => void;
}) {
	if (eligible.length === 0) {
		return null;
	}
	return (
		<section aria-labelledby="focus-period-eligible" className="mt-6">
			<h3 id="focus-period-eligible">{copy.work}</h3>
			<ul>
				{eligible.map((work) => (
					<EligibleRow
						copy={copy}
						key={work.id}
						onAdd={onAdd}
						onMove={onMove}
						work={work}
					/>
				))}
			</ul>
		</section>
	);
}

function EligibleRow({
	copy,
	onAdd,
	onMove,
	work,
}: {
	copy: typeof FOCUS_PERIOD_COPY;
	onAdd: (workId: string) => void;
	onMove: (workId: string) => void;
	work: EligibleWork;
}) {
	const take = useCallback(() => {
		if (work.activePeriodId) {
			onMove(work.id);
			return;
		}
		onAdd(work.id);
	}, [onAdd, onMove, work]);
	return (
		<li>
			<a href={workHref(work)}>
				{`${work.key} ${work.title} (${work.projectName})`}
			</a>
			<Button onClick={take} type="button">
				{work.activePeriodId ? copy.move : copy.add}
			</Button>
		</li>
	);
}

function MemberRow({
	copy,
	live,
	onRemove,
	work,
}: {
	copy: typeof FOCUS_PERIOD_COPY;
	live: boolean;
	onRemove: (workId: string) => void;
	work: FocusPeriodWork;
}) {
	const remove = useCallback(() => {
		onRemove(work.id);
	}, [onRemove, work.id]);
	return (
		<li>
			<a href={workHref(work)}>
				{`${work.key} ${work.title} (${work.projectName})`}
			</a>
			{live ? (
				<Button onClick={remove} type="button" variant="outline">
					{copy.remove}
				</Button>
			) : null}
		</li>
	);
}

function PeriodClosePanels({
	copy,
	period,
	periodId,
}: {
	copy: typeof FOCUS_PERIOD_COPY;
	period: {
		comparison: CloseComparison | null;
		dateComparison: DateComparison | null;
		evaluation: PeriodEvaluation | null;
		members: FocusPeriodWork[];
		stillOpenWork: StillOpenWork;
	};
	periodId: string;
}) {
	const { attemptOnlineWork, markUnsaved } = useClientShell();
	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			predicate: (query) =>
				JSON.stringify(query.queryKey).includes("focusPeriod"),
		});
	}, []);
	const decideStillOpen = useMutation(
		orpc.focusPeriod.decideStillOpen.mutationOptions({
			onSuccess: invalidate,
		})
	);
	const evaluate = useMutation(
		orpc.focusPeriod.evaluate.mutationOptions({
			onSuccess: invalidate,
		})
	);
	const previewFollowUp = useMutation(
		orpc.focusPeriod.previewFollowUp.mutationOptions()
	);
	const confirmFollowUp = useMutation(
		orpc.focusPeriod.confirmFollowUp.mutationOptions({
			onSuccess: invalidate,
		})
	);
	const onDecide = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const data = new FormData(event.currentTarget);
			const destination = String(data.get("destination") ?? "");
			const targetPeriodId = String(data.get("targetPeriodId") ?? "");
			const selected = data.getAll("workId").map((value) => String(value));
			if (selected.length === 0) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				decideStillOpen.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					periodId,
					selections: selected.map((workId) => ({
						destination: destination as
							| "abandon"
							| "another-period"
							| "backlog"
							| "next-period",
						periodId:
							destination === "another-period" && targetPeriodId.length > 0
								? targetPeriodId
								: undefined,
						workId,
					})),
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, decideStillOpen, markUnsaved, periodId]
	);
	const onEvaluate = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const data = new FormData(event.currentTarget);
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				evaluate.mutateAsync({
					change: String(data.get("change") ?? ""),
					idempotencyKey: newIdempotencyKey(),
					keep: String(data.get("keep") ?? ""),
					periodId,
					skipped: data.get("skip") === "on",
					tryNext: String(data.get("tryNext") ?? ""),
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, evaluate, markUnsaved, periodId]
	);
	const onPreviewFollowUp = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const data = new FormData(event.currentTarget);
			const title = String(data.get("followUpTitle") ?? "").trim();
			const projectId = String(data.get("followUpProjectId") ?? "");
			if (!(title && projectId)) {
				return;
			}
			const result = attemptOnlineWork("record-create", () =>
				previewFollowUp.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					periodId,
					projectId,
					title,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, periodId, previewFollowUp]
	);
	const onConfirmFollowUp = useCallback(() => {
		const preview = previewFollowUp.data;
		if (!(preview && preview.status === "committed")) {
			return;
		}
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			confirmFollowUp.mutateAsync({
				idempotencyKey: newIdempotencyKey(),
				periodId,
				previewAcknowledged: true,
				projectId: preview.preview.projectId,
				title: preview.preview.title,
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [
		attemptOnlineWork,
		confirmFollowUp,
		markUnsaved,
		periodId,
		previewFollowUp.data,
	]);
	return (
		<>
			{period.stillOpenWork.opened ? (
				<StillOpenDecision
					copy={copy}
					onDecide={onDecide}
					stillOpenWork={period.stillOpenWork}
				/>
			) : null}
			{period.comparison ? (
				<ComparisonPanel comparison={period.comparison} copy={copy} />
			) : null}
			{period.dateComparison ? (
				<DateComparisonPanel comparison={period.dateComparison} copy={copy} />
			) : null}
			{period.evaluation ? (
				<EvaluationPanel
					copy={copy}
					evaluation={period.evaluation}
					onConfirmFollowUp={onConfirmFollowUp}
					onEvaluate={onEvaluate}
					onPreviewFollowUp={onPreviewFollowUp}
					preview={
						previewFollowUp.data?.status === "committed"
							? previewFollowUp.data.preview
							: null
					}
					projects={[
						...new Map(
							period.members.map((work) => [
								work.projectId,
								{ id: work.projectId, name: work.projectName },
							])
						).values(),
					]}
				/>
			) : null}
		</>
	);
}

function WorkList({ works }: { works: readonly FocusPeriodWork[] }) {
	if (works.length === 0) {
		return null;
	}
	return (
		<ul>
			{works.map((work) => (
				<li key={work.id}>
					<a href={workHref(work)}>{`${work.key} ${work.title}`}</a>
				</li>
			))}
		</ul>
	);
}

function ComparisonPanel({
	comparison,
	copy,
}: {
	comparison: CloseComparison;
	copy: typeof FOCUS_PERIOD_COPY;
}) {
	return (
		<section aria-labelledby="focus-period-comparison" className="mt-6">
			<h3 id="focus-period-comparison">{copy.closed}</h3>
			<h4>{copy.inStartSnapshot}</h4>
			<WorkList works={comparison.inStartSnapshot} />
			<h4>{copy.addedLater}</h4>
			<WorkList works={comparison.addedLater} />
			<h4>{copy.removed}</h4>
			<WorkList works={comparison.removed} />
			<h4>{copy.completed}</h4>
			<WorkList works={comparison.completed} />
			<h4>{copy.stillOpenWork}</h4>
			<WorkList works={comparison.stillOpen} />
		</section>
	);
}

function DateComparisonPanel({
	comparison,
	copy,
}: {
	comparison: DateComparison;
	copy: typeof FOCUS_PERIOD_COPY;
}) {
	return (
		<section aria-labelledby="focus-period-dates" className="mt-6">
			<h3 id="focus-period-dates">{copy.dateComparison}</h3>
			<h4>{copy.movedEarlier}</h4>
			<WorkList works={comparison.movedEarlier} />
			<h4>{copy.movedLater}</h4>
			<WorkList works={comparison.movedLater} />
			<h4>{copy.completedOnTarget}</h4>
			<WorkList works={comparison.completedOnTarget} />
			<h4>{copy.completedAfter}</h4>
			<WorkList works={comparison.completedAfter} />
			<h4>{copy.stillOpenWork}</h4>
			<WorkList works={comparison.stillOpen} />
		</section>
	);
}

function StillOpenDecision({
	copy,
	onDecide,
	stillOpenWork,
}: {
	copy: typeof FOCUS_PERIOD_COPY;
	onDecide: (event: FormEvent<HTMLFormElement>) => void;
	stillOpenWork: StillOpenWork;
}) {
	const destinations = stillOpenWork.destinations.anotherPeriod.map(
		(period) => ({
			id: period.id,
			label: `${copy.anotherPeriod}: ${period.purpose}`,
		})
	);
	return (
		<section aria-labelledby="focus-period-still-open" className="mt-6">
			<h3 id="focus-period-still-open">{copy.stillOpenWork}</h3>
			<form className="grid gap-4" onSubmit={onDecide}>
				<ul>
					{stillOpenWork.stillOpen.map((work) => (
						<li key={work.id}>
							<label>
								<input name="workId" type="checkbox" value={work.id} />{" "}
								<a href={workHref(work)}>{`${work.key} ${work.title}`}</a>
							</label>
						</li>
					))}
				</ul>
				<Field>
					<FieldLabel htmlFor="focus-period-destination">
						{copy.send}
					</FieldLabel>
					<NativeSelect
						defaultValue="backlog"
						id="focus-period-destination"
						name="destination"
					>
						{stillOpenWork.destinations.nextPeriod ? (
							<NativeSelectOption value="next-period">
								{copy.nextPeriod}
							</NativeSelectOption>
						) : null}
						<NativeSelectOption value="backlog">
							{copy.backlog}
						</NativeSelectOption>
						{stillOpenWork.destinations.anotherPeriod.length > 0 ? (
							<NativeSelectOption value="another-period">
								{copy.anotherPeriod}
							</NativeSelectOption>
						) : null}
						<NativeSelectOption value="abandon">
							{copy.abandon}
						</NativeSelectOption>
					</NativeSelect>
				</Field>
				{destinations.length > 0 ? (
					<Field>
						<FieldLabel htmlFor="focus-period-target-period">
							{copy.anotherPeriod}
						</FieldLabel>
						<NativeSelect id="focus-period-target-period" name="targetPeriodId">
							{destinations.map((period) => (
								<NativeSelectOption key={period.id} value={period.id}>
									{period.label}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
				) : null}
				<Button type="submit">{copy.send}</Button>
			</form>
		</section>
	);
}

function EvaluationPanel({
	copy,
	evaluation,
	onConfirmFollowUp,
	onEvaluate,
	onPreviewFollowUp,
	preview,
	projects,
}: {
	copy: typeof FOCUS_PERIOD_COPY;
	evaluation: PeriodEvaluation;
	onConfirmFollowUp: () => void;
	onEvaluate: (event: FormEvent<HTMLFormElement>) => void;
	onPreviewFollowUp: (event: FormEvent<HTMLFormElement>) => void;
	preview: {
		projectId: string;
		relation: { kind: "source-period"; sourcePeriodId: string };
		title: string;
	} | null;
	projects: Array<{ id: string; name: string }>;
}) {
	return (
		<section aria-labelledby="focus-period-evaluation" className="mt-6">
			<h3 id="focus-period-evaluation">{copy.periodEvaluation}</h3>
			<form className="grid gap-4" onSubmit={onEvaluate}>
				<label>
					<input name="skip" type="checkbox" /> {copy.skip}
				</label>
				<Field>
					<FieldLabel htmlFor="focus-period-keep">{copy.keep}</FieldLabel>
					<Input
						defaultValue={evaluation.keep}
						id="focus-period-keep"
						name="keep"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="focus-period-change">{copy.change}</FieldLabel>
					<Input
						defaultValue={evaluation.change}
						id="focus-period-change"
						name="change"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="focus-period-try-next">
						{copy.tryNext}
					</FieldLabel>
					<Input
						defaultValue={evaluation.tryNext}
						id="focus-period-try-next"
						name="tryNext"
					/>
				</Field>
				<Button type="submit">{copy.periodEvaluation}</Button>
			</form>
			<form className="mt-6 grid gap-4" onSubmit={onPreviewFollowUp}>
				<h4>{copy.followUpWork}</h4>
				<WorkList works={evaluation.followUpWork} />
				<Field>
					<FieldLabel htmlFor="focus-period-follow-up-title">
						{copy.followUpWork}
					</FieldLabel>
					<Input id="focus-period-follow-up-title" name="followUpTitle" />
				</Field>
				{projects.length > 0 ? (
					<Field>
						<FieldLabel htmlFor="focus-period-follow-up-project">
							{copy.work}
						</FieldLabel>
						<NativeSelect
							id="focus-period-follow-up-project"
							name="followUpProjectId"
						>
							{projects.map((project) => (
								<NativeSelectOption key={project.id} value={project.id}>
									{project.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
				) : null}
				<Button type="submit">{copy.preview}</Button>
			</form>
			{preview ? (
				<div className="mt-4">
					<p>{`${copy.preview}: ${preview.title}`}</p>
					{preview.relation.kind === "source-period" ? (
						<p>{`${copy.followUpWork} · ${copy.focusPeriod}`}</p>
					) : null}
					<Button onClick={onConfirmFollowUp} type="button">
						{copy.confirm}
					</Button>
				</div>
			) : null}
		</section>
	);
}
