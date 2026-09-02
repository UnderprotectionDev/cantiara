import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { DOCUMENTS_COPY, documentScopeFor } from "../forms/documents-copy";

export default function DocumentVersionHistory({
	baseRevision,
	documentId,
	projectId,
}: {
	baseRevision: number;
	documentId: string;
	projectId: string | null;
}) {
	const [error, setError] = useState<string | null>(null);
	const [leftRevision, setLeftRevision] = useState<number | null>(null);
	const [rightRevision, setRightRevision] = useState<number | null>(null);
	const versions = useQuery(
		orpc.documents.versions.queryOptions({
			input: { documentId },
		})
	);
	const compared = useQuery({
		...orpc.documents.compare.queryOptions({
			input: {
				documentId,
				leftRevision: leftRevision ?? 1,
				rightRevision: rightRevision ?? 1,
			},
		}),
		enabled:
			leftRevision !== null &&
			rightRevision !== null &&
			Boolean(versions.data?.length),
	});

	useEffect(() => {
		const items = versions.data;
		if (!items || items.length === 0) {
			return;
		}
		const first = items[0]?.revision ?? null;
		const last = items.at(-1)?.revision ?? first;
		setLeftRevision((current) => current ?? first);
		setRightRevision((current) => current ?? last);
	}, [versions.data]);

	const restore = useMutation(
		orpc.documents.restore.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					setRightRevision(outcome.document.revision);
					await queryClient.invalidateQueries({
						queryKey: orpc.documents.list.queryKey({
							input: { scope: documentScopeFor(projectId) },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.documents.get.queryKey({
							input: { documentId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.documents.versions.queryKey({
							input: { documentId },
						}),
					});
					setError(null);
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
				if (outcome.status === "conflict") {
					setError(outcome.conflict);
				}
			},
		})
	);

	const onLeftChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setLeftRevision(Number(event.target.value));
	}, []);
	const onRightChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
		setRightRevision(Number(event.target.value));
	}, []);
	const onRestore = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (leftRevision === null) {
				return;
			}
			setError(null);
			restore.mutate({
				baseRevision,
				idempotencyKey: newIdempotencyKey(),
				payload: {
					documentId,
					versionRevision: leftRevision,
				},
			});
		},
		[baseRevision, documentId, leftRevision, restore]
	);

	if (!versions.data || versions.data.length === 0) {
		return null;
	}

	return (
		<section aria-labelledby="document-versions-heading" className="mt-6">
			<h2 className="mb-3 font-medium text-sm" id="document-versions-heading">
				{DOCUMENTS_COPY.versions}
			</h2>
			<form className="flex flex-col gap-3" onSubmit={onRestore}>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="document-version-left">
							{DOCUMENTS_COPY.restore}
						</FieldLabel>
						<VersionSelect
							id="document-version-left"
							onChange={onLeftChange}
							value={leftRevision}
							versions={versions.data}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="document-version-right">
							{DOCUMENTS_COPY.compare}
						</FieldLabel>
						<VersionSelect
							id="document-version-right"
							onChange={onRightChange}
							value={rightRevision}
							versions={versions.data}
						/>
					</Field>
				</FieldGroup>
				{error ? <p role="alert">{error}</p> : null}
				<Button type="submit">{DOCUMENTS_COPY.restore}</Button>
			</form>
			{compared.data ? (
				<section aria-labelledby="document-compare-heading" className="mt-4">
					<h3 className="font-medium text-sm" id="document-compare-heading">
						{DOCUMENTS_COPY.compare}
					</h3>
					<p className="mt-2 text-muted-foreground text-xs">
						{DOCUMENTS_COPY.version} {compared.data.left.revision}:{" "}
						{compared.data.left.title} ({compared.data.left.type}) →{" "}
						{DOCUMENTS_COPY.version} {compared.data.right.revision}:{" "}
						{compared.data.right.title} ({compared.data.right.type})
					</p>
					<pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-none border border-input p-3 font-mono text-xs">
						{keyedHunks(compared.data.hunks).map((hunk) => (
							<span className={hunkClassName(hunk.kind)} key={hunk.key}>
								{hunkPrefix(hunk.kind)}
								{hunk.text}
							</span>
						))}
					</pre>
				</section>
			) : null}
		</section>
	);
}

function VersionSelect({
	id,
	onChange,
	value,
	versions,
}: {
	id: string;
	onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
	value: number | null;
	versions: readonly { id: string; revision: number }[];
}) {
	return (
		<NativeSelect id={id} onChange={onChange} value={String(value ?? "")}>
			{versions.map((item) => (
				<NativeSelectOption
					key={`${id}-${item.id}`}
					value={String(item.revision)}
				>
					{DOCUMENTS_COPY.version} {item.revision}
				</NativeSelectOption>
			))}
		</NativeSelect>
	);
}

function keyedHunks(
	hunks: readonly { kind: "added" | "removed" | "unchanged"; text: string }[]
): { key: string; kind: "added" | "removed" | "unchanged"; text: string }[] {
	let offset = 0;
	return hunks.map((hunk) => {
		const key = `${offset}:${hunk.kind}:${hunk.text}`;
		offset += hunk.text.length;
		return { key, kind: hunk.kind, text: hunk.text };
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
