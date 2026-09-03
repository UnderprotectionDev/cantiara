import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useCallback } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { PROJECT_GOAL_COPY } from "./project-goals-copy";

export default function ProjectGoalsPanel({
	onGoalId,
	projectId,
	selectedGoalId,
}: {
	onGoalId?: (goalId: string | null) => void;
	projectId: string;
	selectedGoalId?: string | null;
}) {
	const { attemptOnlineWork, markUnsaved } = useClientShell();
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
	const onCreate = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const form = event.currentTarget;
			const data = new FormData(form);
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					description: String(data.get("description") ?? ""),
					idempotencyKey: newIdempotencyKey(),
					intendedOutcome: String(data.get("intendedOutcome") ?? ""),
					projectId,
					title: String(data.get("title") ?? ""),
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value
				.then((outcome) => {
					if (outcome.status === "committed") {
						form.reset();
						onGoalId?.(outcome.goal.id);
					}
				})
				.catch(() => undefined);
		},
		[attemptOnlineWork, create, markUnsaved, onGoalId, projectId]
	);
	const onUpdate = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!selectedId) {
				return;
			}
			const data = new FormData(event.currentTarget);
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				update.mutateAsync({
					description: String(data.get("description") ?? ""),
					goalId: selectedId,
					idempotencyKey: newIdempotencyKey(),
					intendedOutcome: String(data.get("intendedOutcome") ?? ""),
					observedOutcome: String(data.get("observedOutcome") ?? ""),
					title: String(data.get("title") ?? ""),
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, markUnsaved, selectedId, update]
	);
	const goal = detail.data;
	return (
		<section aria-label={copy.projectGoal} className="mb-8">
			<h2 className="font-medium text-sm">{copy.projectGoal}</h2>
			<form className="mt-3 flex flex-col gap-3" onSubmit={onCreate}>
				<Field>
					<FieldLabel htmlFor="project-goal-title">{copy.title}</FieldLabel>
					<Input id="project-goal-title" name="title" required />
				</Field>
				<Field>
					<FieldLabel htmlFor="project-goal-description">
						{copy.description}
					</FieldLabel>
					<Textarea id="project-goal-description" name="description" required />
				</Field>
				<Field>
					<FieldLabel htmlFor="project-goal-intended">
						{copy.intendedOutcome}
					</FieldLabel>
					<Textarea id="project-goal-intended" name="intendedOutcome" />
				</Field>
				<Button type="submit">{copy.create}</Button>
			</form>
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
				<form
					aria-label={goal.title}
					className="mt-6 flex flex-col gap-3"
					key={`${goal.id}:${goal.revision}`}
					onSubmit={onUpdate}
				>
					<Field>
						<FieldLabel htmlFor="project-goal-edit-title">
							{copy.title}
						</FieldLabel>
						<Input
							defaultValue={goal.title}
							id="project-goal-edit-title"
							name="title"
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="project-goal-edit-description">
							{copy.description}
						</FieldLabel>
						<Textarea
							defaultValue={goal.description}
							id="project-goal-edit-description"
							name="description"
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="project-goal-edit-intended">
							{copy.intendedOutcome}
						</FieldLabel>
						<Textarea
							defaultValue={goal.intendedOutcome ?? ""}
							id="project-goal-edit-intended"
							name="intendedOutcome"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="project-goal-edit-observed">
							{copy.observedOutcome}
						</FieldLabel>
						<Textarea
							defaultValue={goal.observedOutcome ?? ""}
							id="project-goal-edit-observed"
							name="observedOutcome"
						/>
					</Field>
					<Button type="submit">{copy.save}</Button>
				</form>
			) : null}
		</section>
	);
}
