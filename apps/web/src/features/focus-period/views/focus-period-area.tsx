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
					{period.stillOpenWork.opened ? (
						<section aria-labelledby="focus-period-still-open" className="mt-6">
							<h3 id="focus-period-still-open">{copy.stillOpenWork}</h3>
							<ul>
								{period.stillOpenWork.stillOpen.map((work: FocusPeriodWork) => (
									<li key={work.id}>
										<a href={workHref(work)}>{`${work.key} ${work.title}`}</a>
									</li>
								))}
							</ul>
						</section>
					) : null}
					{live ? (
						<EligibleWork
							copy={copy}
							eligible={period.eligibleWork}
							onAdd={onAdd}
						/>
					) : null}
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
							{`${from} ${edge.direction} ${to} — ${edge.state} (${dependencies.copy.blockedBy})`}
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
}: {
	copy: typeof FOCUS_PERIOD_COPY;
	eligible: readonly FocusPeriodWork[];
	onAdd: (workId: string) => void;
}) {
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const selected = new FormData(event.currentTarget).get("workId");
			if (typeof selected === "string" && selected.length > 0) {
				onAdd(selected);
			}
		},
		[onAdd]
	);
	if (eligible.length === 0) {
		return null;
	}
	return (
		<form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
			<Field className="min-w-56">
				<FieldLabel htmlFor="focus-period-work">{copy.work}</FieldLabel>
				<NativeSelect defaultValue="" id="focus-period-work" name="workId">
					<NativeSelectOption disabled value="">
						{copy.work}
					</NativeSelectOption>
					{eligible.map((work) => (
						<NativeSelectOption key={work.id} value={work.id}>
							{`${work.key} ${work.title} · ${work.projectName}`}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<Button type="submit">{copy.add}</Button>
		</form>
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
