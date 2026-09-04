import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { DECISIONS_COPY } from "./decisions-copy";

export default function SupersedeDecisionForm({
	baseRevision,
	decisionId,
	onSuperseded,
	projectId,
}: {
	baseRevision: number;
	decisionId: string;
	onSuperseded?: () => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [open, setOpen] = useState(false);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [transitionRationale, setTransitionRationale] = useState("");
	const listed = useQuery(
		orpc.decisions.list.queryOptions({ input: { projectId } })
	);
	const candidates = useMemo(
		() =>
			(listed.data ?? []).filter(
				(item) => item.id !== decisionId && item.life === DECISIONS_COPY.valid
			),
		[decisionId, listed.data]
	);
	const selected = useMemo(
		() => candidates.filter((item) => selectedIds.includes(item.id)),
		[candidates, selectedIds]
	);
	const preview = useQuery({
		...orpc.decisions.previewSupersession.queryOptions({
			input: {
				payload: {
					successorId: decisionId,
					supersededIds: selectedIds,
					transitionRationale:
						transitionRationale.trim() === "" ? undefined : transitionRationale,
				},
			},
		}),
		enabled: open && selectedIds.length > 0,
	});
	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.decisions.list.queryKey({
				input: { projectId },
			}),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.decisions.get.queryKey({
				input: { decisionId },
			}),
		});
		await Promise.all(
			selectedIds.map((id) =>
				queryClient.invalidateQueries({
					queryKey: orpc.decisions.get.queryKey({
						input: { decisionId: id },
					}),
				})
			)
		);
	}, [decisionId, projectId, selectedIds]);
	const supersede = useMutation(
		orpc.decisions.supersede.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidate();
					recordSave();
					onSuperseded?.();
					setError(null);
					setOpen(false);
					setSelectedIds([]);
					setTransitionRationale("");
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);
	const onOpen = useCallback(() => {
		setOpen(true);
		setError(null);
	}, []);
	const onRationaleChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setTransitionRationale(event.target.value);
		},
		[]
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (selected.length === 0 || preview.data?.status !== "ok") {
				return;
			}
			setError(null);
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				supersede.mutateAsync({
					baseRevision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						successorId: decisionId,
						supersededIds: selected.map((item) => item.id),
						supersededRevisions: selected.map((item) => ({
							id: item.id,
							revision: item.revision,
						})),
						transitionRationale:
							transitionRationale.trim() === ""
								? undefined
								: transitionRationale,
					},
				})
			);
		},
		[
			attemptOnlineWork,
			baseRevision,
			decisionId,
			markUnsaved,
			preview.data?.status,
			selected,
			supersede,
			transitionRationale,
		]
	);
	if (!open) {
		return (
			<Button onClick={onOpen} type="button">
				{DECISIONS_COPY.supersedeAnotherDecision}
			</Button>
		);
	}
	const previewOk = preview.data?.status === "ok" ? preview.data.preview : null;
	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<h3 className="font-medium text-sm">
				{DECISIONS_COPY.supersedeAnotherDecision}
			</h3>
			<FieldGroup>
				{candidates.map((item) => (
					<CandidateToggle
						checked={selectedIds.includes(item.id)}
						id={item.id}
						key={item.id}
						onToggle={setSelectedIds}
						selected={selectedIds}
						title={item.title}
					/>
				))}
				<Field>
					<FieldLabel htmlFor="supersede-transition-rationale">
						{DECISIONS_COPY.transitionRationale}
					</FieldLabel>
					<Textarea
						id="supersede-transition-rationale"
						onChange={onRationaleChange}
						value={transitionRationale}
					/>
				</Field>
			</FieldGroup>
			{previewOk ? (
				<section aria-label={DECISIONS_COPY.preview}>
					<p className="text-sm">
						{previewOk.successor.title}
						{" · "}
						{previewOk.successor.decision}
						{" · "}
						{previewOk.successor.rationale}
					</p>
					{previewOk.successor.evidenceSummary.length > 0 ? (
						<p className="text-muted-foreground text-xs">
							{`${DECISIONS_COPY.evidence}: ${previewOk.successor.evidenceSummary.join(", ")}`}
						</p>
					) : null}
					<ul className="mt-2 flex flex-col gap-2">
						{previewOk.superseded.map((item) => (
							<li key={item.id}>
								<p className="text-sm">
									{item.title}
									{" · "}
									{item.decision}
									{" · "}
									{item.rationale}
								</p>
								{item.evidenceSummary.length > 0 ? (
									<p className="text-muted-foreground text-xs">
										{`${DECISIONS_COPY.evidence}: ${item.evidenceSummary.join(", ")}`}
									</p>
								) : null}
							</li>
						))}
					</ul>
					<p className="mt-2 text-sm">
						{DECISIONS_COPY.livesChanging}
						{": "}
						{previewOk.livesChanging
							.map((change) => `${change.title} ${change.from} → ${change.to}`)
							.join("; ")}
					</p>
					{previewOk.transitionRationale ? (
						<p className="text-muted-foreground text-sm">
							{previewOk.transitionRationale}
						</p>
					) : null}
				</section>
			) : null}
			{preview.data?.status === "rejected" ? (
				<p role="alert">{preview.data.reason}</p>
			) : null}
			{error ? <p role="alert">{error}</p> : null}
			<Button disabled={!previewOk || supersede.isPending} type="submit">
				{DECISIONS_COPY.confirmSupersession}
			</Button>
		</form>
	);
}

function CandidateToggle({
	checked,
	id,
	onToggle,
	selected,
	title,
}: {
	checked: boolean;
	id: string;
	onToggle: (value: string[]) => void;
	selected: string[];
	title: string;
}) {
	const onCheckedChange = useCallback(
		(next: boolean | "indeterminate") => {
			if (next === true) {
				onToggle([...selected, id]);
				return;
			}
			onToggle(selected.filter((itemId) => itemId !== id));
		},
		[id, onToggle, selected]
	);
	return (
		<Field orientation="horizontal">
			<Checkbox
				aria-label={title}
				checked={checked}
				id={`supersede-${id}`}
				onCheckedChange={onCheckedChange}
			/>
			<FieldLabel htmlFor={`supersede-${id}`}>{title}</FieldLabel>
		</Field>
	);
}
