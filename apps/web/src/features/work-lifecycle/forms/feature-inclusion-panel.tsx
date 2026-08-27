import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { invalidateWork } from "./invalidate-work";
import {
	FEATURE_HEALTH_STATUSES,
	type FeatureHealthStatus,
	WORK_LIFECYCLE_COPY,
	type WorkType,
} from "./work-lifecycle-copy";

interface WorkOption {
	id: string;
	key: string;
	revision: number;
	title: string;
	type: WorkType;
}

export default function FeatureInclusionPanel({
	projectId,
	revision,
	type,
	workId,
	works,
}: {
	projectId: string;
	revision: number;
	type: WorkType;
	workId: string;
	works: WorkOption[];
}) {
	const scope = useQuery(
		orpc.workLifecycle.getScope.queryOptions({ input: { workId } })
	);
	const progress = useQuery({
		...orpc.workLifecycle.progress.queryOptions({ input: { workId } }),
		enabled: type === "Feature",
	});
	if (scope.isPending) {
		return null;
	}
	if (scope.isError || !scope.data) {
		return <p role="alert">{WORK_LIFECYCLE_COPY.includedWork}</p>;
	}
	const candidates = works.filter((item) => item.id !== workId);
	return (
		<section className="flex flex-col gap-4">
			{scope.data.includedIn ? (
				<p className="text-sm">
					{WORK_LIFECYCLE_COPY.includedIn}{" "}
					<span className="font-mono">{scope.data.includedIn.key}</span>{" "}
					{scope.data.includedIn.title}
				</p>
			) : null}
			{type === "Feature" ? (
				<>
					<IncludeWorkForm
						candidates={candidates.filter((item) => item.type !== "Feature")}
						featureId={workId}
						included={scope.data.includedWork}
						projectId={projectId}
					/>
					{progress.data ? (
						<p className="text-muted-foreground text-sm">
							{WORK_LIFECYCLE_COPY.includedWork} {progress.data.closedCount}/
							{progress.data.includedCount} {WORK_LIFECYCLE_COPY.closed}
						</p>
					) : null}
					<FeatureHealthForm
						history={scope.data.healthHistory}
						projectId={projectId}
						revision={revision}
						workId={workId}
					/>
					<PrimarySpecForm
						primarySpec={scope.data.primarySpec}
						projectId={projectId}
						revision={revision}
						workId={workId}
					/>
				</>
			) : null}
			<RelateWorkForm
				candidates={candidates.filter((item) => item.type === "Feature")}
				fromWorkId={workId}
				projectId={projectId}
				related={scope.data.relatedWork}
				revision={revision}
			/>
		</section>
	);
}

function IncludeWorkForm({
	candidates,
	featureId,
	included,
	projectId,
}: {
	candidates: WorkOption[];
	featureId: string;
	included: Array<{ id: string; key: string; title: string }>;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [firstCandidate] = candidates;
	const [workId, setWorkId] = useState(firstCandidate ? firstCandidate.id : "");
	const include = useMutation(
		orpc.workLifecycle.include.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, featureId);
					if (outcome.work.id !== featureId) {
						await invalidateWork(projectId, outcome.work.id);
					}
					recordSave();
				}
			},
		})
	);
	const detach = useMutation(
		orpc.workLifecycle.detachIncluded.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, featureId);
					await invalidateWork(projectId, outcome.work.id);
					recordSave();
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const selected = candidates.find((item) => item.id === workId);
			if (!selected) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				include.mutateAsync({
					baseRevision: selected.revision,
					featureId,
					idempotencyKey: newIdempotencyKey(),
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, candidates, featureId, include, markUnsaved, workId]
	);
	return (
		<div className="flex flex-col gap-2">
			<h3 className="font-medium text-sm">{WORK_LIFECYCLE_COPY.includes}</h3>
			<ul className="flex flex-col gap-1 text-sm">
				{included.map((item) => (
					<IncludedWorkRow
						candidates={candidates}
						detach={detach.mutateAsync}
						item={item}
						key={item.id}
					/>
				))}
			</ul>
			<form className="flex flex-col gap-3" onSubmit={onSubmit}>
				<FieldGroup className="flex-row flex-wrap items-end gap-3">
					<WorkOptionField
						id="include-work"
						label={WORK_LIFECYCLE_COPY.includedWork}
						onValueChange={setWorkId}
						options={candidates}
						value={workId}
					/>
					<Button
						disabled={include.isPending || workId.length === 0}
						type="submit"
					>
						{WORK_LIFECYCLE_COPY.includes}
					</Button>
				</FieldGroup>
			</form>
		</div>
	);
}

function IncludedWorkRow({
	candidates,
	detach,
	item,
}: {
	candidates: WorkOption[];
	detach: (input: {
		baseRevision: number;
		idempotencyKey: string;
		workId: string;
	}) => Promise<unknown>;
	item: { id: string; key: string; title: string };
}) {
	const { attemptOnlineWork, markUnsaved } = useClientShell();
	const onDetach = useCallback(() => {
		const selected = candidates.find((candidate) => candidate.id === item.id);
		if (!selected) {
			return;
		}
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			detach({
				baseRevision: selected.revision,
				idempotencyKey: newIdempotencyKey(),
				workId: item.id,
			})
		);
		if (result.status !== "refused") {
			result.value.catch(() => undefined);
		}
	}, [attemptOnlineWork, candidates, detach, item.id, markUnsaved]);
	return (
		<li className="flex items-center justify-between gap-2">
			<span>
				<span className="font-mono text-muted-foreground">{item.key}</span>{" "}
				{item.title}
			</span>
			<Button onClick={onDetach} size="sm" type="button" variant="ghost">
				{WORK_LIFECYCLE_COPY.detach}
			</Button>
		</li>
	);
}

function RelateWorkForm({
	candidates,
	fromWorkId,
	projectId,
	related,
	revision,
}: {
	candidates: WorkOption[];
	fromWorkId: string;
	projectId: string;
	related: Array<{ id: string; key: string; title: string }>;
	revision: number;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [firstCandidate] = candidates;
	const [toWorkId, setToWorkId] = useState(
		firstCandidate ? firstCandidate.id : ""
	);
	const relate = useMutation(
		orpc.workLifecycle.relate.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, fromWorkId);
					await invalidateWork(projectId, toWorkId);
					recordSave();
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (toWorkId.length === 0) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				relate.mutateAsync({
					baseRevision: revision,
					fromWorkId,
					idempotencyKey: newIdempotencyKey(),
					toWorkId,
				})
			);
			if (result.status !== "refused") {
				result.value.catch(() => undefined);
			}
		},
		[attemptOnlineWork, fromWorkId, markUnsaved, relate, revision, toWorkId]
	);
	return (
		<div className="flex flex-col gap-2">
			<h3 className="font-medium text-sm">{WORK_LIFECYCLE_COPY.related}</h3>
			<ul className="text-sm">
				{related.map((item) => (
					<li key={item.id}>
						<span className="font-mono text-muted-foreground">{item.key}</span>{" "}
						{item.title}
					</li>
				))}
			</ul>
			<form className="flex flex-col gap-3" onSubmit={onSubmit}>
				<FieldGroup className="flex-row flex-wrap items-end gap-3">
					<WorkOptionField
						id="relate-work"
						label={WORK_LIFECYCLE_COPY.related}
						onValueChange={setToWorkId}
						options={candidates}
						value={toWorkId}
					/>
					<Button
						disabled={relate.isPending || toWorkId.length === 0}
						type="submit"
					>
						{WORK_LIFECYCLE_COPY.related}
					</Button>
				</FieldGroup>
			</form>
		</div>
	);
}

function FeatureHealthForm({
	history,
	projectId,
	revision,
	workId,
}: {
	history: Array<{ id: string; reason: string | null; status: string }>;
	projectId: string;
	revision: number;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [status, setStatus] = useState<FeatureHealthStatus>("On Track");
	const [reason, setReason] = useState("");
	const record = useMutation(
		orpc.workLifecycle.recordHealth.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, workId);
					recordSave();
				}
			},
		})
	);
	const detach = useMutation(
		orpc.workLifecycle.detachHealth.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, workId);
					recordSave();
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				record.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					reason: reason.trim() || undefined,
					status,
					workId,
				})
			);
			if (result.status !== "refused") {
				result.value.catch(() => undefined);
			}
		},
		[attemptOnlineWork, markUnsaved, reason, record, revision, status, workId]
	);
	const onDetach = useCallback(() => {
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			detach.mutateAsync({
				baseRevision: revision,
				idempotencyKey: newIdempotencyKey(),
				workId,
			})
		);
		if (result.status !== "refused") {
			result.value.catch(() => undefined);
		}
	}, [attemptOnlineWork, detach, markUnsaved, revision, workId]);
	return (
		<div className="flex flex-col gap-2">
			<h3 className="font-medium text-sm">
				{WORK_LIFECYCLE_COPY.featureHealth}
			</h3>
			<ul className="text-sm">
				{history.map((entry) => (
					<li key={entry.id}>
						{entry.status}
						{entry.reason ? ` · ${entry.reason}` : ""}
					</li>
				))}
			</ul>
			<form className="flex flex-col gap-3" onSubmit={onSubmit}>
				<FieldGroup className="flex-row flex-wrap items-end gap-3">
					<HealthField onValueChange={setStatus} value={status} />
					<ReasonField onValueChange={setReason} value={reason} />
					<Button disabled={record.isPending} type="submit">
						{WORK_LIFECYCLE_COPY.recordHealth}
					</Button>
					<Button
						disabled={detach.isPending || history.length === 0}
						onClick={onDetach}
						type="button"
						variant="ghost"
					>
						{WORK_LIFECYCLE_COPY.detach}
					</Button>
				</FieldGroup>
			</form>
		</div>
	);
}

function PrimarySpecForm({
	primarySpec,
	projectId,
	revision,
	workId,
}: {
	primarySpec: { id: string; title: string } | null;
	projectId: string;
	revision: number;
	workId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [specId, setSpecId] = useState(primarySpec ? primarySpec.id : "");
	const [title, setTitle] = useState(primarySpec ? primarySpec.title : "");
	const bind = useMutation(
		orpc.workLifecycle.bindPrimarySpec.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, workId);
					recordSave();
				}
			},
		})
	);
	const detach = useMutation(
		orpc.workLifecycle.detachPrimarySpec.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, workId);
					recordSave();
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const trimmedTitle = title.trim();
			const trimmedId = specId.trim();
			if (trimmedTitle.length === 0 || trimmedId.length === 0) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("record-create", () =>
				bind.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					primarySpec: {
						id: trimmedId,
						title: trimmedTitle,
					},
					workId,
				})
			);
			if (result.status !== "refused") {
				result.value.catch(() => undefined);
			}
		},
		[attemptOnlineWork, bind, markUnsaved, revision, specId, title, workId]
	);
	const onDetach = useCallback(() => {
		markUnsaved();
		const result = attemptOnlineWork("record-create", () =>
			detach.mutateAsync({
				baseRevision: revision,
				idempotencyKey: newIdempotencyKey(),
				workId,
			})
		);
		if (result.status !== "refused") {
			result.value.catch(() => undefined);
		}
	}, [attemptOnlineWork, detach, markUnsaved, revision, workId]);
	return (
		<div className="flex flex-col gap-2">
			<h3 className="font-medium text-sm">{WORK_LIFECYCLE_COPY.primarySpec}</h3>
			{primarySpec ? <p className="text-sm">{primarySpec.title}</p> : null}
			<form className="flex flex-col gap-3" onSubmit={onSubmit}>
				<FieldGroup className="flex-row flex-wrap items-end gap-3">
					<TitleField
						id="primary-spec-id"
						label={WORK_LIFECYCLE_COPY.primarySpec}
						onValueChange={setSpecId}
						value={specId}
					/>
					<TitleField
						id="primary-spec-title"
						label={WORK_LIFECYCLE_COPY.title}
						onValueChange={setTitle}
						value={title}
					/>
					<Button disabled={bind.isPending} type="submit">
						{WORK_LIFECYCLE_COPY.primarySpec}
					</Button>
					<Button
						disabled={detach.isPending || !primarySpec}
						onClick={onDetach}
						type="button"
						variant="ghost"
					>
						{WORK_LIFECYCLE_COPY.detach}
					</Button>
				</FieldGroup>
			</form>
		</div>
	);
}

function WorkOptionField({
	id,
	label,
	onValueChange,
	options,
	value,
}: {
	id: string;
	label: string;
	onValueChange: (value: string) => void;
	options: WorkOption[];
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field className="min-w-48 flex-1">
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<NativeSelect
				className="w-full"
				id={id}
				onChange={onChange}
				value={value}
			>
				{options.map((item) => (
					<NativeSelectOption key={item.id} value={item.id}>
						{item.key} {item.title}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}

function HealthField({
	onValueChange,
	value,
}: {
	onValueChange: (value: FeatureHealthStatus) => void;
	value: FeatureHealthStatus;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange(event.target.value as FeatureHealthStatus);
		},
		[onValueChange]
	);
	return (
		<Field className="w-40">
			<FieldLabel htmlFor="feature-health">
				{WORK_LIFECYCLE_COPY.featureHealth}
			</FieldLabel>
			<NativeSelect
				className="w-full"
				id="feature-health"
				onChange={onChange}
				value={value}
			>
				{FEATURE_HEALTH_STATUSES.map((health) => (
					<NativeSelectOption key={health} value={health}>
						{health}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}

function ReasonField({
	onValueChange,
	value,
}: {
	onValueChange: (value: string) => void;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field className="min-w-48 flex-1">
			<FieldLabel htmlFor="feature-health-reason">
				{WORK_LIFECYCLE_COPY.reason}
			</FieldLabel>
			<Input id="feature-health-reason" onChange={onChange} value={value} />
		</Field>
	);
}

function TitleField({
	id,
	label,
	onValueChange,
	value,
}: {
	id: string;
	label: string;
	onValueChange: (value: string) => void;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field className="min-w-48 flex-1">
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input id={id} onChange={onChange} value={value} />
		</Field>
	);
}
