import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { createPriorityCriterionError } from "../forms/create-priority-criterion-error";
import {
	PRIORITY_COPY,
	type PrioritizationSessionCardView,
	type PrioritizationSessionView,
} from "../forms/priority-copy";

export default function PrioritizationSessionArea({
	projectId,
	work,
}: {
	projectId: string;
	work: Array<{ id: string; title: string }>;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [openId, setOpenId] = useState<string | null>(null);
	const sessions = useQuery(
		orpc.priority.listSessions.queryOptions({ input: { projectId } })
	);
	const create = useMutation(orpc.priority.createSession.mutationOptions());

	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.priority.listSessions.queryKey({ input: { projectId } }),
		});
	}, [projectId]);

	const onNameChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setName(event.target.value);
			markUnsaved();
		},
		[markUnsaved]
	);
	const onToggleWork = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const workId = event.currentTarget.value;
			setSelectedIds((current) =>
				current.includes(workId)
					? current.filter((id) => id !== workId)
					: [...current, workId]
			);
			markUnsaved();
		},
		[markUnsaved]
	);
	const onOpenSession = useCallback((event: MouseEvent<HTMLButtonElement>) => {
		setOpenId(event.currentTarget.value);
	}, []);

	const onCreate = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			const result = attemptOnlineWork("planning-change", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						name,
						projectId,
						workIds: selectedIds,
					},
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value
				.then(async (outcome) => {
					if (outcome.status === "committed" || outcome.status === "replayed") {
						recordSave();
						setName("");
						setSelectedIds([]);
						setOpenId(outcome.session.id);
						await invalidate();
						return;
					}
					const message = createPriorityCriterionError(outcome);
					if (message) {
						setError(message);
					}
				})
				.catch(() => undefined);
		},
		[
			attemptOnlineWork,
			create,
			invalidate,
			name,
			projectId,
			recordSave,
			selectedIds,
		]
	);

	if (sessions.isPending) {
		return null;
	}
	if (sessions.isError) {
		return <p role="alert">{PRIORITY_COPY.nameRequired}</p>;
	}

	const opened =
		sessions.data.find((session) => session.id === openId) ??
		sessions.data[0] ??
		null;

	return (
		<section aria-label={PRIORITY_COPY.createPrioritizationSession}>
			<h2 className="font-medium text-sm">
				{PRIORITY_COPY.createPrioritizationSession}
			</h2>
			<form className="mt-3 flex flex-col gap-3" onSubmit={onCreate}>
				<Field>
					<FieldLabel htmlFor="prioritization-session-name">
						{PRIORITY_COPY.name}
					</FieldLabel>
					<Input
						id="prioritization-session-name"
						onChange={onNameChange}
						value={name}
					/>
				</Field>
				<ul className="flex flex-col gap-1">
					{work.map((item) => (
						<li key={item.id}>
							<label className="flex items-center gap-2 text-sm">
								<input
									checked={selectedIds.includes(item.id)}
									onChange={onToggleWork}
									type="checkbox"
									value={item.id}
								/>
								{item.title}
							</label>
						</li>
					))}
				</ul>
				<Button size="sm" type="submit">
					{PRIORITY_COPY.createPrioritizationSession}
				</Button>
				{error ? (
					<p className="text-destructive text-sm" role="alert">
						{error}
					</p>
				) : null}
			</form>
			{sessions.data.length > 0 ? (
				<nav aria-label={PRIORITY_COPY.sessionOrder} className="mt-4">
					<ul className="flex flex-col gap-1">
						{sessions.data.map((session) => (
							<li key={session.id}>
								<Button
									aria-pressed={opened?.id === session.id}
									onClick={onOpenSession}
									size="sm"
									type="button"
									value={session.id}
									variant={opened?.id === session.id ? "secondary" : "ghost"}
								>
									{session.name}
								</Button>
							</li>
						))}
					</ul>
				</nav>
			) : null}
			{opened ? (
				<SessionDetail onChanged={invalidate} session={opened} />
			) : null}
		</section>
	);
}

function SessionDetail({
	onChanged,
	session,
}: {
	onChanged: () => Promise<void>;
	session: PrioritizationSessionView;
}) {
	const { attemptOnlineWork, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const reorder = useMutation(orpc.priority.reorderSession.mutationOptions());
	const close = useMutation(orpc.priority.closeSession.mutationOptions());
	const reopen = useMutation(orpc.priority.reopenSession.mutationOptions());
	const archive = useMutation(orpc.priority.archiveSession.mutationOptions());
	const readOnly = session.closedAt !== null;

	const runFlag = useCallback(
		(
			action: (input: {
				idempotencyKey: string;
				payload: { sessionId: string };
			}) => Promise<unknown>
		) => {
			const result = attemptOnlineWork("planning-change", () =>
				action({
					idempotencyKey: newIdempotencyKey(),
					payload: { sessionId: session.id },
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value
				.then(async () => {
					recordSave();
					await onChanged();
				})
				.catch(() => undefined);
		},
		[attemptOnlineWork, onChanged, recordSave, session.id]
	);
	const onClose = useCallback(() => {
		runFlag(close.mutateAsync);
	}, [close.mutateAsync, runFlag]);
	const onReopen = useCallback(() => {
		runFlag(reopen.mutateAsync);
	}, [reopen.mutateAsync, runFlag]);
	const onArchive = useCallback(() => {
		runFlag(archive.mutateAsync);
	}, [archive.mutateAsync, runFlag]);
	const onMoveWork = useCallback(
		(workId: string, direction: number) => {
			const ids = [...session.comparison.sessionOrder];
			const index = ids.indexOf(workId);
			const next = index + direction;
			if (index < 0 || next < 0 || next >= ids.length) {
				return;
			}
			const swap = ids[index];
			const other = ids[next];
			if (!(swap && other)) {
				return;
			}
			ids[index] = other;
			ids[next] = swap;
			setError(null);
			const result = attemptOnlineWork("planning-change", () =>
				reorder.mutateAsync({
					baseRevision: session.revision,
					idempotencyKey: newIdempotencyKey(),
					payload: { sessionId: session.id, workIds: ids },
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value
				.then(async (outcome) => {
					if (outcome.status === "committed" || outcome.status === "replayed") {
						recordSave();
						await onChanged();
						return;
					}
					setError(createPriorityCriterionError(outcome));
				})
				.catch(() => undefined);
		},
		[attemptOnlineWork, onChanged, recordSave, reorder, session]
	);

	return (
		<div className="mt-4 flex flex-col gap-4">
			<p className="text-muted-foreground text-xs">
				{session.closedAt
					? new Date(session.closedAt).toISOString()
					: session.createdAt}
			</p>
			<div className="flex flex-wrap gap-2">
				{readOnly ? (
					<Button onClick={onReopen} size="sm" type="button">
						{PRIORITY_COPY.reopen}
					</Button>
				) : (
					<Button onClick={onClose} size="sm" type="button">
						{PRIORITY_COPY.close}
					</Button>
				)}
				<Button onClick={onArchive} size="sm" type="button" variant="ghost">
					{PRIORITY_COPY.archive}
				</Button>
			</div>
			{error ? (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			) : null}
			<div className="grid gap-4 md:grid-cols-2">
				<section aria-label={PRIORITY_COPY.sessionOrder}>
					<h3 className="font-medium text-sm">{PRIORITY_COPY.sessionOrder}</h3>
					<ol className="mt-2 flex flex-col">
						{session.cards.map((card, index) => (
							<SessionCard
								card={card}
								index={index}
								key={card.workId}
								lastIndex={session.cards.length - 1}
								onMoveWork={onMoveWork}
								readOnly={readOnly}
							/>
						))}
					</ol>
				</section>
				<section aria-label={PRIORITY_COPY.backlog}>
					<h3 className="font-medium text-sm">{PRIORITY_COPY.backlog}</h3>
					<ol className="mt-2 flex flex-col">
						{session.comparison.backlogOrder.map((workId) => (
							<BacklogRow
								card={session.cards.find((item) => item.workId === workId)}
								key={workId}
								workId={workId}
							/>
						))}
					</ol>
				</section>
			</div>
		</div>
	);
}

function SessionCard({
	card,
	index,
	lastIndex,
	onMoveWork,
	readOnly,
}: {
	card: PrioritizationSessionCardView;
	index: number;
	lastIndex: number;
	onMoveWork: (workId: string, direction: number) => void;
	readOnly: boolean;
}) {
	const onMoveUp = useCallback(() => {
		onMoveWork(card.workId, -1);
	}, [card.workId, onMoveWork]);
	const onMoveDown = useCallback(() => {
		onMoveWork(card.workId, 1);
	}, [card.workId, onMoveWork]);
	const ranks = card.criterionValues
		.map((value) =>
			value.notEvaluated
				? `${value.name}: ${PRIORITY_COPY.unevaluated}`
				: `${value.name}: ${value.rank}`
		)
		.join(" · ");
	return (
		<li className="border-border border-b py-2">
			<div className="flex items-start justify-between gap-2">
				<div>
					<p className="text-sm">{card.title}</p>
					<p className="text-muted-foreground text-xs">{ranks}</p>
					<p className="text-muted-foreground text-xs">
						{PRIORITY_COPY.targetDate}: {card.targetDate ?? "—"} ·{" "}
						{PRIORITY_COPY.risk}: {card.riskCount} · {PRIORITY_COPY.evidence}:{" "}
						{card.evidence.feedbackRecords}
					</p>
				</div>
				{readOnly ? null : (
					<div className="flex shrink-0 flex-col gap-1">
						<Button
							disabled={index === 0}
							onClick={onMoveUp}
							size="sm"
							type="button"
							variant="ghost"
						>
							{PRIORITY_COPY.moveUp}
						</Button>
						<Button
							disabled={index === lastIndex}
							onClick={onMoveDown}
							size="sm"
							type="button"
							variant="ghost"
						>
							{PRIORITY_COPY.moveDown}
						</Button>
					</div>
				)}
			</div>
		</li>
	);
}

function BacklogRow({
	card,
	workId,
}: {
	card: PrioritizationSessionCardView | undefined;
	workId: string;
}) {
	return <li className="py-2 text-sm">{card?.title ?? workId}</li>;
}
