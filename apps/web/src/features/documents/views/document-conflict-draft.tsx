import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { DOCUMENTS_COPY, documentScopeFor } from "../forms/documents-copy";

export default function DocumentConflictDraftPanel({
	documentId,
	projectId,
	revision,
}: {
	documentId: string;
	projectId: string | null;
	revision: number;
}) {
	const [choices, setChoices] = useState<("current" | "draft")[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [spawnTitle, setSpawnTitle] = useState("");
	const compared = useQuery(
		orpc.documents.compareConflictDraft.queryOptions({
			input: { documentId },
		})
	);

	useEffect(() => {
		const hunks = compared.data?.hunks;
		if (!hunks) {
			return;
		}
		setChoices(
			hunks.map((hunk) => (hunk.kind === "unchanged" ? "current" : "draft"))
		);
		setSpawnTitle(compared.data?.draft.title ?? "");
	}, [compared.data]);

	const invalidate = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.documents.get.queryKey({ input: { documentId } }),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.documents.list.queryKey({
				input: { scope: documentScopeFor(projectId) },
			}),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.documents.versions.queryKey({ input: { documentId } }),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.documents.conflictDraft.queryKey({
				input: { documentId },
			}),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.documents.compareConflictDraft.queryKey({
				input: { documentId },
			}),
		});
	}, [documentId, projectId]);

	const apply = useMutation(
		orpc.documents.applyConflictDraft.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidate();
					setError(null);
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);
	const spawn = useMutation(
		orpc.documents.spawnFromConflictDraft.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidate();
					setError(null);
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);
	const remove = useMutation(
		orpc.documents.deleteConflictDraft.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidate();
					setError(null);
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);

	const onApply = useCallback(
		(event: FormEvent) => {
			event.preventDefault();
			apply.mutate({
				baseRevision: revision,
				idempotencyKey: newIdempotencyKey(),
				payload: { documentId, hunkChoices: choices },
			});
		},
		[apply, choices, documentId, revision]
	);
	const onSpawn = useCallback(
		(event: FormEvent) => {
			event.preventDefault();
			spawn.mutate({
				idempotencyKey: newIdempotencyKey(),
				payload: { documentId, title: spawnTitle },
			});
		},
		[documentId, spawn, spawnTitle]
	);
	const onDelete = useCallback(() => {
		remove.mutate({
			idempotencyKey: newIdempotencyKey(),
			payload: { documentId },
		});
	}, [documentId, remove]);
	const onSpawnTitle = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setSpawnTitle(event.target.value);
	}, []);
	const onChoice = useCallback((index: number, value: "current" | "draft") => {
		setChoices((current) =>
			current.map((choice, choiceIndex) =>
				choiceIndex === index ? value : choice
			)
		);
	}, []);

	if (!compared.data) {
		return null;
	}

	return (
		<section aria-labelledby="conflict-draft-heading" className="mt-6">
			<h2 className="mb-3 font-medium text-sm" id="conflict-draft-heading">
				{DOCUMENTS_COPY.conflictDraft}
			</h2>
			<pre className="overflow-x-auto whitespace-pre-wrap rounded-none border border-input p-3 font-mono text-xs">
				{keyedHunks(compared.data.hunks).map((hunk) => (
					<ConflictDraftHunk
						choice={choices[hunk.index] ?? "draft"}
						hunk={hunk}
						key={hunk.key}
						onChoice={onChoice}
					/>
				))}
			</pre>
			{error ? <p role="alert">{error}</p> : null}
			<form className="mt-3 flex flex-col gap-3" onSubmit={onApply}>
				<Button type="submit">{DOCUMENTS_COPY.apply}</Button>
			</form>
			<form className="mt-3 flex flex-col gap-3" onSubmit={onSpawn}>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="conflict-draft-spawn-title">
							{DOCUMENTS_COPY.title}
						</FieldLabel>
						<Input
							id="conflict-draft-spawn-title"
							onChange={onSpawnTitle}
							value={spawnTitle}
						/>
					</Field>
				</FieldGroup>
				<Button type="submit">{DOCUMENTS_COPY.createFromConflictDraft}</Button>
			</form>
			<Button className="mt-3" onClick={onDelete} type="button">
				{DOCUMENTS_COPY.deleteConflictDraft}
			</Button>
		</section>
	);
}

function ConflictDraftHunk({
	choice,
	hunk,
	onChoice,
}: {
	choice: "current" | "draft";
	hunk: {
		index: number;
		key: string;
		kind: "added" | "removed" | "unchanged";
		text: string;
	};
	onChoice: (index: number, value: "current" | "draft") => void;
}) {
	const onToggle = useCallback(() => {
		onChoice(hunk.index, choice === "draft" ? "current" : "draft");
	}, [choice, hunk.index, onChoice]);
	return (
		<span className={hunkClassName(hunk.kind)}>
			{hunkPrefix(hunk.kind)}
			{hunk.text}
			{hunk.kind === "unchanged" ? null : (
				<button className="ml-2 underline" onClick={onToggle} type="button">
					{choice === "draft"
						? DOCUMENTS_COPY.conflictDraft
						: DOCUMENTS_COPY.document}
				</button>
			)}
		</span>
	);
}

function keyedHunks(
	hunks: readonly { kind: "added" | "removed" | "unchanged"; text: string }[]
): {
	index: number;
	key: string;
	kind: "added" | "removed" | "unchanged";
	text: string;
}[] {
	let offset = 0;
	return hunks.map((hunk, index) => {
		const key = `${offset}:${hunk.kind}:${hunk.text}`;
		offset += hunk.text.length;
		return { index, key, kind: hunk.kind, text: hunk.text };
	});
}

function hunkClassName(kind: "added" | "removed" | "unchanged"): string {
	if (kind === "added") {
		return "bg-emerald-500/15";
	}
	if (kind === "removed") {
		return "bg-rose-500/15";
	}
	return "";
}

function hunkPrefix(kind: "added" | "removed" | "unchanged"): string {
	if (kind === "added") {
		return "+ ";
	}
	if (kind === "removed") {
		return "- ";
	}
	return "  ";
}
