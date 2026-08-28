import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent, MouseEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { invalidateTags } from "./invalidate-tags";
import { TAGS_COPY } from "./tags-copy";

export default function WorkTagPicker({
	appliedTagIds,
	projectId,
	revision,
	workId,
}: {
	appliedTagIds: string[];
	projectId: string;
	revision: number;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [lastRename, setLastRename] = useState<{
		historyEntryId: string;
		revision: number;
		tagId: string;
	} | null>(null);
	const suggestions = useQuery(
		orpc.tags.suggest.queryOptions({ input: { projectId } })
	);
	const create = useMutation(
		orpc.tags.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status !== "committed" && outcome.status !== "replayed") {
					setError("Conflict");
					return;
				}
				const applied = await apply.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					tagId: outcome.tag.id,
					workId,
				});
				if (applied.status === "committed" || applied.status === "replayed") {
					setName("");
				}
			},
		})
	);
	const apply = useMutation(
		orpc.tags.apply.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateTags(projectId, workId, outcome.tag.id);
					recordSave();
					setError(null);
					return;
				}
				setError("Conflict");
			},
		})
	);
	const rename = useMutation(
		orpc.tags.rename.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateTags(projectId, workId, outcome.tag.id);
					recordSave();
					setError(null);
					setLastRename({
						historyEntryId: outcome.historyEntryId,
						revision: outcome.tag.revision,
						tagId: outcome.tag.id,
					});
					return;
				}
				setError("Conflict");
			},
		})
	);
	const undoRename = useMutation(
		orpc.tags.undoRename.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateTags(projectId, workId, outcome.tag.id);
					recordSave();
					setError(null);
					setLastRename(null);
					return;
				}
				setError("Conflict");
			},
		})
	);
	const remove = useMutation(
		orpc.tags.remove.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateTags(projectId, workId, outcome.tag.id);
					recordSave();
					setError(null);
					return;
				}
				setError("Conflict");
			},
		})
	);
	const onCreate = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					name,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, create, markUnsaved, name]
	);
	const onApply = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				apply.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					tagId: event.currentTarget.value,
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[apply, attemptOnlineWork, markUnsaved, revision, workId]
	);
	const onRemove = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				remove.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					tagId: event.currentTarget.value,
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, markUnsaved, remove, revision, workId]
	);
	const onRename = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const form = event.currentTarget;
			const { revision: tagRevision, tagId } = form.dataset;
			const baseRevision = Number(tagRevision);
			const nextName = String(new FormData(form).get("name") ?? "");
			if (!tagId || Number.isNaN(baseRevision)) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				rename.mutateAsync({
					baseRevision,
					idempotencyKey: newIdempotencyKey(),
					name: nextName,
					tagId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, markUnsaved, rename]
	);
	const onUndoRename = useCallback(() => {
		if (!lastRename) {
			return;
		}
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			undoRename.mutateAsync({
				baseRevision: lastRename.revision,
				historyEntryId: lastRename.historyEntryId,
				idempotencyKey: newIdempotencyKey(),
				tagId: lastRename.tagId,
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value.catch(() => undefined);
	}, [attemptOnlineWork, lastRename, markUnsaved, undoRename]);
	const tags = suggestions.data ?? [];
	const applied = new Set(appliedTagIds);
	const query = name.trim().toLowerCase();
	const appliedTags = tags.filter((tag) => applied.has(tag.id));
	const available = tags.filter((tag) => {
		if (applied.has(tag.id)) {
			return false;
		}
		if (query === "") {
			return true;
		}
		return tag.name.toLowerCase().includes(query);
	});
	const pending =
		create.isPending ||
		apply.isPending ||
		remove.isPending ||
		rename.isPending ||
		undoRename.isPending;

	return (
		<section aria-label={TAGS_COPY.tags} className="flex flex-col gap-3">
			<h3 className="font-medium text-sm tracking-tight">{TAGS_COPY.tags}</h3>
			{appliedTags.length > 0 ? (
				<ul className="flex flex-col gap-2">
					{appliedTags.map((tag) => (
						<li
							className="flex items-center justify-between gap-3 text-sm"
							key={tag.id}
						>
							<span>{tag.name}</span>
							<div className="flex flex-wrap items-center gap-2">
								<AppliedTagRename
									disabled={pending}
									onRename={onRename}
									revision={tag.revision}
									tagId={tag.id}
								/>
								{lastRename?.tagId === tag.id ? (
									<Button
										disabled={pending}
										onClick={onUndoRename}
										size="sm"
										type="button"
										variant="ghost"
									>
										{TAGS_COPY.undo}
									</Button>
								) : null}
								<Button
									disabled={pending}
									onClick={onRemove}
									size="sm"
									type="button"
									value={tag.id}
									variant="ghost"
								>
									{TAGS_COPY.removeTag}
								</Button>
							</div>
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground text-sm">{TAGS_COPY.noTags}</p>
			)}
			<form className="flex flex-col gap-3" onSubmit={onCreate}>
				<FieldGroup className="flex-row flex-wrap items-end gap-3">
					<TagNameField onValueChange={setName} value={name} workId={workId} />
					<Button disabled={pending} type="submit">
						{TAGS_COPY.createTag}
					</Button>
				</FieldGroup>
			</form>
			<div className="flex flex-col gap-2">
				<p className="text-muted-foreground text-xs">
					{TAGS_COPY.suggestedInThisProject}
				</p>
				{available.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{TAGS_COPY.noMatchingTags}
					</p>
				) : (
					<ul className="flex flex-col gap-2">
						{available.map((tag) => (
							<li
								className="flex items-center justify-between gap-3 text-sm"
								key={tag.id}
							>
								<span>{tag.name}</span>
								<Button
									disabled={pending}
									onClick={onApply}
									size="sm"
									type="button"
									value={tag.id}
									variant="ghost"
								>
									{TAGS_COPY.applyTag}
								</Button>
							</li>
						))}
					</ul>
				)}
			</div>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}

function AppliedTagRename({
	disabled,
	onRename,
	revision,
	tagId,
}: {
	disabled: boolean;
	onRename: (event: FormEvent<HTMLFormElement>) => void;
	revision: number;
	tagId: string;
}) {
	const [value, setValue] = useState("");
	const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setValue(event.target.value);
	}, []);
	return (
		<form
			className="flex flex-wrap items-end gap-2"
			data-revision={String(revision)}
			data-tag-id={tagId}
			onSubmit={onRename}
		>
			<Field>
				<FieldLabel htmlFor={`rename-tag-${tagId}`}>
					{TAGS_COPY.name}
				</FieldLabel>
				<Input
					id={`rename-tag-${tagId}`}
					name="name"
					onChange={onChange}
					value={value}
				/>
			</Field>
			<Button disabled={disabled} size="sm" type="submit">
				{TAGS_COPY.renameTag}
			</Button>
		</form>
	);
}

function TagNameField({
	onValueChange,
	value,
	workId,
}: {
	onValueChange: (value: string) => void;
	value: string;
	workId: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor={`tag-name-${workId}`}>{TAGS_COPY.name}</FieldLabel>
			<Input id={`tag-name-${workId}`} onChange={onChange} value={value} />
		</Field>
	);
}
