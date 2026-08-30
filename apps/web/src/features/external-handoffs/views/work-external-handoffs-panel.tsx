import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
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
	EXTERNAL_HANDOFFS_COPY,
	SELECTED_VERSION_KINDS,
} from "./external-handoffs-copy";

interface ExtraVersion {
	body: string;
	id: string;
	kind: (typeof SELECTED_VERSION_KINDS)[number];
	recordId: string;
	title: string;
	versionId: string;
}

export default function WorkExternalHandoffsPanel({
	revision,
	workId,
	workKey,
	workTitle,
}: {
	revision: number;
	workId: string;
	workKey: string;
	workTitle: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [purpose, setPurpose] = useState("");
	const [expectedOutput, setExpectedOutput] = useState("");
	const [executor, setExecutor] = useState("");
	const [constraints, setConstraints] = useState("");
	const [github, setGithub] = useState("");
	const [includeThisWork, setIncludeThisWork] = useState(true);
	const [extraVersions, setExtraVersions] = useState<ExtraVersion[]>([]);
	const [error, setError] = useState<string | null>(null);
	const listed = useQuery(
		orpc.externalHandoffs.list.queryOptions({
			input: { workId },
		})
	);
	const start = useMutation(
		orpc.externalHandoffs.start.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.externalHandoffs.list.queryKey({
							input: { workId },
						}),
					});
					recordSave();
					setError(null);
					return;
				}
				setError("Conflict");
			},
		})
	);
	const onPurpose = useCallback((value: string) => {
		setPurpose(value);
	}, []);
	const onExpectedOutput = useCallback((value: string) => {
		setExpectedOutput(value);
	}, []);
	const onExecutor = useCallback((value: string) => {
		setExecutor(value);
	}, []);
	const onConstraints = useCallback((value: string) => {
		setConstraints(value);
	}, []);
	const onGithub = useCallback((value: string) => {
		setGithub(value);
	}, []);
	const onIncludeThisWork = useCallback(
		(checked: boolean | "indeterminate") => {
			setIncludeThisWork(checked === true);
		},
		[]
	);
	const onAddSelectedVersion = useCallback(() => {
		setExtraVersions((current) => [
			...current,
			{
				body: "",
				id: crypto.randomUUID(),
				kind: "Document",
				recordId: "",
				title: "",
				versionId: "",
			},
		]);
	}, []);
	const onExtraChange = useCallback((next: ExtraVersion) => {
		setExtraVersions((current) =>
			current.map((item) => (item.id === next.id ? next : item))
		);
	}, []);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			const selectedVersions = [
				...(includeThisWork
					? [
							{
								kind: "Work" as const,
								recordId: workId,
								title: workTitle,
								versionId: String(revision),
							},
						]
					: []),
				...extraVersions.filter(
					(version) =>
						version.recordId.trim() !== "" && version.versionId.trim() !== ""
				),
			];
			const permittedGithubContext = github
				.split(",")
				.map((identifier) => identifier.trim())
				.filter((identifier) => identifier.length > 0)
				.map((identifier) => ({ identifier }));
			const result = attemptOnlineWork("record-create", () =>
				start.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						constraints,
						executorVisibleName: executor,
						expectedOutput,
						permittedGithubContext,
						purpose,
						selectedVersions,
						workId,
					},
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[
			attemptOnlineWork,
			constraints,
			executor,
			expectedOutput,
			extraVersions,
			github,
			includeThisWork,
			markUnsaved,
			purpose,
			revision,
			start,
			workId,
			workTitle,
		]
	);
	return (
		<section className="flex flex-col gap-3">
			<h3 className="font-medium text-sm">
				{EXTERNAL_HANDOFFS_COPY.externalExecutionHandoff}
			</h3>
			{listed.data && listed.data.length > 0 ? (
				<ul className="flex flex-col gap-3">
					{listed.data.map((handoff) => (
						<li className="flex flex-col gap-2 text-sm" key={handoff.id}>
							<p>
								<span className="font-mono">{handoff.id}</span> {handoff.status}
							</p>
							<pre className="overflow-auto whitespace-pre-wrap rounded-none border p-2 text-xs">
								{handoff.goingPackage.markdown}
							</pre>
						</li>
					))}
				</ul>
			) : null}
			<form className="flex flex-col gap-3" onSubmit={onSubmit}>
				<FieldGroup>
					<TextField
						id={`handoff-purpose-${workId}`}
						label={EXTERNAL_HANDOFFS_COPY.purpose}
						multiline
						onValueChange={onPurpose}
						value={purpose}
					/>
					<TextField
						id={`handoff-expected-${workId}`}
						label={EXTERNAL_HANDOFFS_COPY.expectedOutput}
						multiline
						onValueChange={onExpectedOutput}
						value={expectedOutput}
					/>
					<TextField
						id={`handoff-executor-${workId}`}
						label={EXTERNAL_HANDOFFS_COPY.executor}
						onValueChange={onExecutor}
						value={executor}
					/>
					<TextField
						id={`handoff-constraints-${workId}`}
						label={EXTERNAL_HANDOFFS_COPY.constraints}
						multiline
						onValueChange={onConstraints}
						value={constraints}
					/>
					<TextField
						id={`handoff-github-${workId}`}
						label={EXTERNAL_HANDOFFS_COPY.github}
						onValueChange={onGithub}
						value={github}
					/>
					<Field className="flex flex-row items-center gap-2">
						<Checkbox
							checked={includeThisWork}
							id={`handoff-include-work-${workId}`}
							onCheckedChange={onIncludeThisWork}
						/>
						<FieldLabel htmlFor={`handoff-include-work-${workId}`}>
							{EXTERNAL_HANDOFFS_COPY.includeThisWork} {workKey}
						</FieldLabel>
					</Field>
				</FieldGroup>
				{extraVersions.map((version) => (
					<ExtraVersionFields
						key={version.id}
						onValueChange={onExtraChange}
						version={version}
						workId={workId}
					/>
				))}
				<div className="flex flex-wrap gap-2">
					<Button
						onClick={onAddSelectedVersion}
						type="button"
						variant="outline"
					>
						{EXTERNAL_HANDOFFS_COPY.addSelectedVersion}
					</Button>
					<Button disabled={start.isPending} type="submit">
						{EXTERNAL_HANDOFFS_COPY.startHandoff}
					</Button>
				</div>
				{error ? <p role="alert">{error}</p> : null}
			</form>
		</section>
	);
}

function TextField({
	id,
	label,
	multiline,
	onValueChange,
	value,
}: {
	id: string;
	label: string;
	multiline?: boolean;
	onValueChange: (value: string) => void;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{multiline ? (
				<Textarea id={id} onChange={onChange} value={value} />
			) : (
				<Input id={id} onChange={onChange} value={value} />
			)}
		</Field>
	);
}

function ExtraVersionFields({
	onValueChange,
	version,
	workId,
}: {
	onValueChange: (version: ExtraVersion) => void;
	version: ExtraVersion;
	workId: string;
}) {
	const onKind = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange({
				...version,
				kind: event.target.value as ExtraVersion["kind"],
			});
		},
		[onValueChange, version]
	);
	const onRecordId = useCallback(
		(value: string) => {
			onValueChange({ ...version, recordId: value });
		},
		[onValueChange, version]
	);
	const onVersionId = useCallback(
		(value: string) => {
			onValueChange({ ...version, versionId: value });
		},
		[onValueChange, version]
	);
	const onTitle = useCallback(
		(value: string) => {
			onValueChange({ ...version, title: value });
		},
		[onValueChange, version]
	);
	const onBody = useCallback(
		(value: string) => {
			onValueChange({ ...version, body: value });
		},
		[onValueChange, version]
	);
	return (
		<FieldGroup>
			<Field>
				<FieldLabel htmlFor={`handoff-kind-${workId}-${version.id}`}>
					{EXTERNAL_HANDOFFS_COPY.kind}
				</FieldLabel>
				<NativeSelect
					id={`handoff-kind-${workId}-${version.id}`}
					onChange={onKind}
					value={version.kind}
				>
					{SELECTED_VERSION_KINDS.map((kind) => (
						<NativeSelectOption key={kind} value={kind}>
							{kind}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<TextField
				id={`handoff-record-${workId}-${version.id}`}
				label={EXTERNAL_HANDOFFS_COPY.recordId}
				onValueChange={onRecordId}
				value={version.recordId}
			/>
			<TextField
				id={`handoff-version-${workId}-${version.id}`}
				label={EXTERNAL_HANDOFFS_COPY.versionId}
				onValueChange={onVersionId}
				value={version.versionId}
			/>
			<TextField
				id={`handoff-title-${workId}-${version.id}`}
				label={EXTERNAL_HANDOFFS_COPY.title}
				onValueChange={onTitle}
				value={version.title}
			/>
			<TextField
				id={`handoff-body-${workId}-${version.id}`}
				label={EXTERNAL_HANDOFFS_COPY.body}
				multiline
				onValueChange={onBody}
				value={version.body}
			/>
		</FieldGroup>
	);
}
