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
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import {
	PROJECT_GOAL_COPY,
	projectGoalWriteNotice,
} from "./project-goals-copy";

export default function ProjectGoalsPanel({
	onGoalId,
	projectId,
	selectedGoalId,
}: {
	onGoalId?: (goalId: string | null) => void;
	projectId: string;
	selectedGoalId?: string | null;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [description, setDescription] = useState("");
	const [intendedOutcome, setIntendedOutcome] = useState("");
	const [title, setTitle] = useState("");
	const [writeError, setWriteError] = useState<string | null>(null);
	const catalog = useQuery(orpc.projectGoals.catalog.queryOptions());
	const list = useQuery(
		orpc.projectGoals.list.queryOptions({ input: { projectId } })
	);
	const copy = catalog.data?.copy ?? PROJECT_GOAL_COPY;
	const goals = list.data ?? [];
	const selectedId =
		selectedGoalId && goals.some((item) => item.id === selectedGoalId)
			? selectedGoalId
			: undefined;
	const detail = useQuery({
		...orpc.projectGoals.get.queryOptions({
			input: { goalId: selectedId ?? "" },
		}),
		enabled: Boolean(selectedId),
	});
	const invalidate = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: orpc.projectGoals.list.queryKey({ input: { projectId } }),
			}),
			queryClient.invalidateQueries({
				predicate: (query) =>
					JSON.stringify(query.queryKey).includes("projectGoals") ||
					JSON.stringify(query.queryKey).includes("projectOverview"),
			}),
		]);
	}, [projectId]);
	const create = useMutation(
		orpc.projectGoals.create.mutationOptions({
			onSuccess: invalidate,
		})
	);
	const update = useMutation(
		orpc.projectGoals.update.mutationOptions({
			onSuccess: invalidate,
		})
	);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onDescriptionChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setDescription(event.target.value);
		},
		[]
	);
	const onIntendedOutcomeChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setIntendedOutcome(event.target.value);
		},
		[]
	);
	const onCreate = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setWriteError(null);
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					description,
					idempotencyKey: newIdempotencyKey(),
					intendedOutcome,
					projectId,
					title,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value
				.then((outcome) => {
					const notice = projectGoalWriteNotice(outcome);
					if (notice) {
						setWriteError(notice);
						return;
					}
					if (outcome.status === "committed") {
						setDescription("");
						setIntendedOutcome("");
						setTitle("");
						recordSave();
						onGoalId?.(outcome.goal.id);
					}
				})
				.catch(() => {
					setWriteError(copy.unavailable);
				});
		},
		[
			attemptOnlineWork,
			copy.unavailable,
			create,
			description,
			intendedOutcome,
			markUnsaved,
			onGoalId,
			projectId,
			recordSave,
			title,
		]
	);
	const onUpdate = useCallback(
		(fields: {
			description: string;
			intendedOutcome: string;
			observedOutcome: string;
			title: string;
		}) => {
			if (!selectedId) {
				return;
			}
			setWriteError(null);
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				update.mutateAsync({
					description: fields.description,
					goalId: selectedId,
					idempotencyKey: newIdempotencyKey(),
					intendedOutcome: fields.intendedOutcome,
					observedOutcome: fields.observedOutcome,
					title: fields.title,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value
				.then((outcome) => {
					const notice = projectGoalWriteNotice(outcome);
					if (notice) {
						setWriteError(notice);
						return;
					}
					if (outcome.status === "committed") {
						recordSave();
					}
				})
				.catch(() => {
					setWriteError(copy.unavailable);
				});
		},
		[
			attemptOnlineWork,
			copy.unavailable,
			markUnsaved,
			recordSave,
			selectedId,
			update,
		]
	);
	const goal = detail.data;
	return (
		<section aria-label={copy.projectGoal} className="mb-8">
			<h2 className="font-medium text-sm">{copy.projectGoal}</h2>
			<form className="mt-3 flex flex-col gap-3" onSubmit={onCreate}>
				<Field>
					<FieldLabel htmlFor="project-goal-title">{copy.title}</FieldLabel>
					<Input
						id="project-goal-title"
						onChange={onTitleChange}
						required
						value={title}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="project-goal-description">
						{copy.description}
					</FieldLabel>
					<Textarea
						id="project-goal-description"
						onChange={onDescriptionChange}
						required
						value={description}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="project-goal-intended">
						{copy.intendedOutcome}
					</FieldLabel>
					<Textarea
						id="project-goal-intended"
						onChange={onIntendedOutcomeChange}
						value={intendedOutcome}
					/>
				</Field>
				<Button disabled={create.isPending} type="submit">
					{copy.create}
				</Button>
			</form>
			{writeError ? (
				<p className="mt-3 text-destructive text-sm" role="alert">
					{writeError}
				</p>
			) : null}
			{goals.length === 0 ? (
				<p className="mt-4 text-muted-foreground text-sm">{copy.empty}</p>
			) : (
				<ul className="mt-4 flex flex-col gap-2">
					{goals.map((item) => (
						<li key={item.id}>
							<a
								aria-current={item.id === selectedId ? "page" : undefined}
								className={
									item.id === selectedId
										? "font-medium text-foreground"
										: "text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
								}
								href={`?goal=${encodeURIComponent(item.id)}#overview`}
							>
								{item.title}
							</a>
						</li>
					))}
				</ul>
			)}
			{goal ? (
				<>
					<ProjectGoalEditForm
						copy={copy}
						goal={goal}
						key={`${goal.id}:${goal.revision}`}
						onSave={onUpdate}
						pending={update.isPending}
					/>
					<ProjectGoalMembership
						copy={copy}
						goal={goal}
						onError={setWriteError}
						projectId={projectId}
					/>
				</>
			) : null}
		</section>
	);
}

function ProjectGoalEditForm({
	copy,
	goal,
	onSave,
	pending,
}: {
	copy: typeof PROJECT_GOAL_COPY;
	goal: {
		description: string;
		id: string;
		intendedOutcome: string | null;
		observedOutcome: string | null;
		revision: number;
		title: string;
	};
	onSave: (fields: {
		description: string;
		intendedOutcome: string;
		observedOutcome: string;
		title: string;
	}) => void;
	pending: boolean;
}) {
	const [description, setDescription] = useState(goal.description);
	const [intendedOutcome, setIntendedOutcome] = useState(
		goal.intendedOutcome ?? ""
	);
	const [observedOutcome, setObservedOutcome] = useState(
		goal.observedOutcome ?? ""
	);
	const [title, setTitle] = useState(goal.title);
	const onTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTitle(event.target.value);
	}, []);
	const onDescriptionChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setDescription(event.target.value);
		},
		[]
	);
	const onIntendedOutcomeChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setIntendedOutcome(event.target.value);
		},
		[]
	);
	const onObservedOutcomeChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setObservedOutcome(event.target.value);
		},
		[]
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			onSave({
				description,
				intendedOutcome,
				observedOutcome,
				title,
			});
		},
		[description, intendedOutcome, observedOutcome, onSave, title]
	);
	return (
		<form
			aria-label={goal.title}
			className="mt-6 flex flex-col gap-3"
			onSubmit={onSubmit}
		>
			<Field>
				<FieldLabel htmlFor="project-goal-edit-title">{copy.title}</FieldLabel>
				<Input
					id="project-goal-edit-title"
					onChange={onTitleChange}
					required
					value={title}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor="project-goal-edit-description">
					{copy.description}
				</FieldLabel>
				<Textarea
					id="project-goal-edit-description"
					onChange={onDescriptionChange}
					required
					value={description}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor="project-goal-edit-intended">
					{copy.intendedOutcome}
				</FieldLabel>
				<Textarea
					id="project-goal-edit-intended"
					onChange={onIntendedOutcomeChange}
					value={intendedOutcome}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor="project-goal-edit-observed">
					{copy.observedOutcome}
				</FieldLabel>
				<Textarea
					id="project-goal-edit-observed"
					onChange={onObservedOutcomeChange}
					value={observedOutcome}
				/>
			</Field>
			<Button disabled={pending} type="submit">
				{copy.save}
			</Button>
		</form>
	);
}

interface GoalDetail {
	contributions: Array<{
		from: {
			id: string;
			kind: string;
			reason?: string;
			status: "resolved" | "broken";
			title?: string;
		};
		id: string;
		type: string;
	}>;
	id: string;
	liveSummary: {
		copy: {
			contributesToGoal: string;
			openQuestion: string;
			openSourceRecord: string;
			risk: string;
		};
		relatedOpen: Array<{
			contributes: false;
			id: string;
			kind: "Risk" | "Question";
			openSourceRecord: boolean;
			title?: string;
		}>;
		statusMix: Array<{
			id: string;
			kind: "Work" | "Milestone";
			openSourceRecord: true;
			status: string;
			title: string;
			workType?: "Research" | "Feature";
		}>;
	};
}

function ProjectGoalMembership({
	copy,
	goal,
	onError,
	projectId,
}: {
	copy: typeof PROJECT_GOAL_COPY;
	goal: GoalDetail;
	onError: (message: string | null) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const works = useQuery(
		orpc.workLifecycle.list.queryOptions({ input: { projectId } })
	);
	const milestones = useQuery(
		orpc.roadmapHorizon.listMilestones.queryOptions({
			input: { projectId },
		})
	);
	const invalidate = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				predicate: (query) =>
					JSON.stringify(query.queryKey).includes("projectGoals") ||
					JSON.stringify(query.queryKey).includes("workLifecycle") ||
					JSON.stringify(query.queryKey).includes("roadmapHorizon"),
			}),
		]);
	}, []);
	const contribute = useMutation(
		orpc.projectGoals.contributeToGoal.mutationOptions({
			onSuccess: invalidate,
		})
	);
	const remove = useMutation(
		orpc.projectGoals.removeContribution.mutationOptions({
			onSuccess: invalidate,
		})
	);
	const onContribute = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const form = event.currentTarget;
			const data = new FormData(form);
			const selected = String(data.get("member") ?? "");
			const parsed = parseMemberValue(selected);
			if (!parsed) {
				return;
			}
			onError(null);
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				contribute.mutateAsync({
					from: parsed,
					goalId: goal.id,
					idempotencyKey: newIdempotencyKey(),
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value
				.then((outcome) => {
					const notice = projectGoalWriteNotice(outcome);
					if (notice) {
						onError(notice);
						return;
					}
					if (outcome.status === "committed") {
						recordSave();
						form.reset();
					}
				})
				.catch(() => {
					onError(copy.unavailable);
				});
		},
		[
			attemptOnlineWork,
			contribute,
			copy.unavailable,
			goal.id,
			markUnsaved,
			onError,
			recordSave,
		]
	);
	const onRemove = useCallback(
		(relationId: string) => {
			onError(null);
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				remove.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					relationId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value
				.then((outcome) => {
					const notice = projectGoalWriteNotice(outcome);
					if (notice) {
						onError(notice);
						return;
					}
					if (outcome.status === "committed") {
						recordSave();
					}
				})
				.catch(() => {
					onError(copy.unavailable);
				});
		},
		[
			attemptOnlineWork,
			copy.unavailable,
			markUnsaved,
			onError,
			recordSave,
			remove,
		]
	);
	const workRows = works.data ?? [];
	const milestoneRows = milestones.data ?? [];
	const summary = goal.liveSummary;
	return (
		<section
			aria-label={copy.contributesToGoal}
			className="mt-6 flex flex-col gap-3"
		>
			<h3 className="font-medium text-sm">{copy.contributesToGoal}</h3>
			{goal.contributions.length === 0 ? (
				<p className="text-muted-foreground text-sm">{copy.noContributions}</p>
			) : (
				<ul className="flex flex-col gap-2">
					{goal.contributions.map((row) => (
						<li
							className="flex flex-wrap items-center justify-between gap-2 text-sm"
							key={row.id}
						>
							<span>
								{row.from.status === "resolved"
									? (row.from.title ?? row.from.kind)
									: (row.from.reason ?? row.from.kind)}
							</span>
							<span className="flex items-center gap-2">
								{row.from.status === "resolved" && row.from.kind === "Work" ? (
									<a
										className="underline-offset-4 hover:underline"
										href={`?work=${encodeURIComponent(row.from.id)}#work`}
									>
										{copy.openSourceRecord}
									</a>
								) : null}
								<GoalContributionRemove
									label={copy.remove}
									onRemove={onRemove}
									relationId={row.id}
								/>
							</span>
						</li>
					))}
				</ul>
			)}
			<form className="flex flex-col gap-3" onSubmit={onContribute}>
				<Field>
					<FieldLabel htmlFor={`project-goal-member-${goal.id}`}>
						{copy.contributesToGoal}
					</FieldLabel>
					<NativeSelect
						defaultValue=""
						id={`project-goal-member-${goal.id}`}
						name="member"
					>
						<NativeSelectOption value="">
							{copy.contributesToGoal}
						</NativeSelectOption>
						{workRows.map((work) => (
							<NativeSelectOption key={work.id} value={`Work:${work.id}`}>
								{work.key} {work.title}
							</NativeSelectOption>
						))}
						{milestoneRows.map((milestone) => (
							<NativeSelectOption
								key={milestone.id}
								value={`Milestone:${milestone.id}`}
							>
								{milestone.title} · {milestone.status}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Button
					disabled={
						contribute.isPending ||
						(workRows.length === 0 && milestoneRows.length === 0)
					}
					size="sm"
					type="submit"
				>
					{copy.contributesToGoal}
				</Button>
			</form>
			<ul className="flex flex-col gap-2 text-sm">
				{summary.statusMix.map((item) => (
					<li key={`${item.kind}:${item.id}`}>
						{item.workType ? `${item.workType} · ` : null}
						{item.title} · {item.status}{" "}
						{item.openSourceRecord && item.kind === "Work" ? (
							<a
								className="underline-offset-4 hover:underline"
								href={`?work=${encodeURIComponent(item.id)}#work`}
							>
								{summary.copy.openSourceRecord}
							</a>
						) : null}
					</li>
				))}
				{summary.relatedOpen.map((item) => (
					<li key={`${item.kind}:${item.id}`}>
						{item.kind === "Risk"
							? summary.copy.risk
							: summary.copy.openQuestion}
						{item.title ? ` ${item.title}` : ""}
					</li>
				))}
			</ul>
		</section>
	);
}

function parseMemberValue(
	value: string
): { id: string; kind: "Work" | "Milestone" | "Project Release" } | null {
	const separator = value.indexOf(":");
	if (separator <= 0) {
		return null;
	}
	const kind = value.slice(0, separator);
	const id = value.slice(separator + 1);
	if (id.length === 0) {
		return null;
	}
	if (kind === "Work" || kind === "Milestone" || kind === "Project Release") {
		return { id, kind };
	}
	return null;
}

function GoalContributionRemove({
	label,
	onRemove,
	relationId,
}: {
	label: string;
	onRemove: (relationId: string) => void;
	relationId: string;
}) {
	const onClick = useCallback(() => {
		onRemove(relationId);
	}, [onRemove, relationId]);
	return (
		<Button onClick={onClick} size="sm" type="button" variant="ghost">
			{label}
		</Button>
	);
}
