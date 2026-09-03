import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
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
				<ProjectGoalEditForm
					copy={copy}
					goal={goal}
					key={`${goal.id}:${goal.revision}`}
					onSave={onUpdate}
					pending={update.isPending}
				/>
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
