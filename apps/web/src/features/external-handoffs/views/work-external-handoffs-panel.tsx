import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
	Field,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@cantiara/ui/components/field";
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
import { MUTATION_COPY, newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import {
	EXTERNAL_HANDOFFS_COPY,
	presentHandoffCard,
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
	const clearStartForm = useCallback(() => {
		setPurpose("");
		setExpectedOutput("");
		setExecutor("");
		setConstraints("");
		setGithub("");
		setIncludeThisWork(true);
		setExtraVersions([]);
	}, []);
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
					clearStartForm();
					return;
				}
				setError(MUTATION_COPY.conflict);
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
	const onRemoveExtra = useCallback((id: string) => {
		setExtraVersions((current) => current.filter((item) => item.id !== id));
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
		<section className="flex flex-col gap-4">
			<header className="flex flex-col gap-1">
				<h3 className="font-medium text-sm tracking-tight">
					{EXTERNAL_HANDOFFS_COPY.externalExecutionHandoff}
				</h3>
				<p className="text-muted-foreground text-xs leading-relaxed">
					{EXTERNAL_HANDOFFS_COPY.sourceOfTruth}
				</p>
			</header>
			{listed.data && listed.data.length > 0 ? (
				<ul className="flex flex-col gap-3">
					{listed.data.map((handoff) => {
						const card = presentHandoffCard(handoff);
						return (
							<li className="flex flex-col gap-3 border p-3" key={handoff.id}>
								<header className="flex items-start justify-between gap-3">
									<p className="min-w-0 font-medium text-sm leading-snug">
										<span className="font-mono text-muted-foreground">
											{handoff.workKey}
										</span>{" "}
										{card.title}
									</p>
									<Badge variant="secondary">{card.status}</Badge>
								</header>
								<p className="font-mono text-muted-foreground text-xs">
									{EXTERNAL_HANDOFFS_COPY.handoff} {handoff.id}
								</p>
								<dl className="grid gap-1 text-muted-foreground text-xs">
									<div className="flex flex-wrap gap-x-2">
										<dt>{EXTERNAL_HANDOFFS_COPY.executor}</dt>
										<dd>{handoff.executorVisibleName}</dd>
									</div>
									<div className="flex flex-wrap gap-x-2">
										<dt>{EXTERNAL_HANDOFFS_COPY.expectedOutput}</dt>
										<dd>{handoff.expectedOutput}</dd>
									</div>
									{handoff.constraints.trim() === "" ? null : (
										<div className="flex flex-wrap gap-x-2">
											<dt>{EXTERNAL_HANDOFFS_COPY.constraints}</dt>
											<dd>{handoff.constraints}</dd>
										</div>
									)}
									<div className="flex flex-wrap gap-x-2">
										<dt>{EXTERNAL_HANDOFFS_COPY.producedAt}</dt>
										<dd>
											<time dateTime={card.producedAt}>{card.producedAt}</time>
										</dd>
									</div>
								</dl>
								<details open>
									<summary className="cursor-pointer font-medium text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring">
										{EXTERNAL_HANDOFFS_COPY.goingPackage}
									</summary>
									<pre className="mt-2 overflow-auto whitespace-pre-wrap border bg-muted/40 p-2 text-xs leading-relaxed">
										{handoff.goingPackage.markdown}
									</pre>
								</details>
							</li>
						);
					})}
				</ul>
			) : null}
			<form className="flex flex-col gap-4" onSubmit={onSubmit}>
				<FieldSet>
					<FieldLegend>{EXTERNAL_HANDOFFS_COPY.startHandoff}</FieldLegend>
					<FieldGroup>
						<TextField
							id={`handoff-purpose-${workId}`}
							label={EXTERNAL_HANDOFFS_COPY.purpose}
							multiline
							onValueChange={onPurpose}
							rows={3}
							value={purpose}
						/>
						<TextField
							id={`handoff-expected-${workId}`}
							label={EXTERNAL_HANDOFFS_COPY.expectedOutput}
							multiline
							onValueChange={onExpectedOutput}
							rows={3}
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
							rows={3}
							value={constraints}
						/>
						<TextField
							id={`handoff-github-${workId}`}
							label={EXTERNAL_HANDOFFS_COPY.github}
							onValueChange={onGithub}
							value={github}
						/>
					</FieldGroup>
				</FieldSet>
				<FieldSet>
					<FieldLegend>{EXTERNAL_HANDOFFS_COPY.selectedVersions}</FieldLegend>
					<Field
						className="flex flex-row items-center gap-2"
						orientation="horizontal"
					>
						<Checkbox
							checked={includeThisWork}
							id={`handoff-include-work-${workId}`}
							onCheckedChange={onIncludeThisWork}
						/>
						<FieldLabel htmlFor={`handoff-include-work-${workId}`}>
							{EXTERNAL_HANDOFFS_COPY.includeThisWork}{" "}
							<span className="font-mono text-muted-foreground">{workKey}</span>
						</FieldLabel>
					</Field>
					{extraVersions.map((version) => (
						<ExtraVersionFields
							key={version.id}
							onRemove={onRemoveExtra}
							onValueChange={onExtraChange}
							version={version}
							workId={workId}
						/>
					))}
				</FieldSet>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<Button
						onClick={onAddSelectedVersion}
						size="sm"
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
	rows,
	value,
}: {
	id: string;
	label: string;
	multiline?: boolean;
	onValueChange: (value: string) => void;
	rows?: number;
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
				<Textarea id={id} onChange={onChange} rows={rows} value={value} />
			) : (
				<Input id={id} onChange={onChange} value={value} />
			)}
		</Field>
	);
}

function ExtraVersionFields({
	onRemove,
	onValueChange,
	version,
	workId,
}: {
	onRemove: (id: string) => void;
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
	const onRemoveClick = useCallback(() => {
		onRemove(version.id);
	}, [onRemove, version.id]);
	return (
		<FieldGroup className="border p-3">
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
				rows={3}
				value={version.body}
			/>
			<Button onClick={onRemoveClick} size="sm" type="button" variant="ghost">
				{EXTERNAL_HANDOFFS_COPY.removeSelectedVersion}
			</Button>
		</FieldGroup>
	);
}
