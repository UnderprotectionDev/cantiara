import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback } from "react";

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
	const form = useForm({
		defaultValues: { workId: firstCandidate ? firstCandidate.id : "" },
		onSubmit: async ({ value }) => {
			const selected = candidates.find((item) => item.id === value.workId);
			if (!selected) {
				return;
			}
			const result = attemptOnlineWork("record-create", () =>
				include.mutateAsync({
					baseRevision: selected.revision,
					featureId,
					idempotencyKey: newIdempotencyKey(),
					workId: value.workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			await result.value;
		},
	});
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			form.handleSubmit().catch(() => undefined);
		},
		[form, markUnsaved]
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
					<form.Field name="workId">
						{(field) => (
							<WorkOptionField
								id="include-work"
								label={WORK_LIFECYCLE_COPY.includedWork}
								onValueChange={field.handleChange}
								options={candidates}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<Button
						disabled={include.isPending || candidates.length === 0}
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
	const relate = useMutation(
		orpc.workLifecycle.relate.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, fromWorkId);
					recordSave();
				}
			},
		})
	);
	const form = useForm({
		defaultValues: { toWorkId: firstCandidate ? firstCandidate.id : "" },
		onSubmit: async ({ value }) => {
			if (value.toWorkId.length === 0) {
				return;
			}
			const result = attemptOnlineWork("record-create", () =>
				relate.mutateAsync({
					baseRevision: revision,
					fromWorkId,
					idempotencyKey: newIdempotencyKey(),
					toWorkId: value.toWorkId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			await result.value;
			await invalidateWork(projectId, value.toWorkId);
		},
	});
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			form.handleSubmit().catch(() => undefined);
		},
		[form, markUnsaved]
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
					<form.Field name="toWorkId">
						{(field) => (
							<WorkOptionField
								id="relate-work"
								label={WORK_LIFECYCLE_COPY.related}
								onValueChange={field.handleChange}
								options={candidates}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<Button
						disabled={relate.isPending || candidates.length === 0}
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
	const form = useForm({
		defaultValues: {
			reason: "",
			status: "On Track" as FeatureHealthStatus,
		},
		onSubmit: async ({ value }) => {
			const result = attemptOnlineWork("record-create", () =>
				record.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					reason: value.reason.trim() || undefined,
					status: value.status,
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			await result.value;
		},
	});
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			form.handleSubmit().catch(() => undefined);
		},
		[form, markUnsaved]
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
					<form.Field name="status">
						{(field) => (
							<HealthField
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="reason">
						{(field) => (
							<ReasonField
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
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
	const form = useForm({
		defaultValues: {
			specId: primarySpec ? primarySpec.id : "",
			title: primarySpec ? primarySpec.title : "",
		},
		onSubmit: async ({ value }) => {
			const trimmedTitle = value.title.trim();
			const trimmedId = value.specId.trim();
			if (trimmedTitle.length === 0 || trimmedId.length === 0) {
				return;
			}
			const result = attemptOnlineWork("record-create", () =>
				bind.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					primarySpec: { id: trimmedId, title: trimmedTitle },
					workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			await result.value;
		},
	});
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			form.handleSubmit().catch(() => undefined);
		},
		[form, markUnsaved]
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
					<form.Field name="specId">
						{(field) => (
							<TitleField
								id="primary-spec-id"
								label={WORK_LIFECYCLE_COPY.primarySpec}
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="title">
						{(field) => (
							<TitleField
								id="primary-spec-title"
								label={WORK_LIFECYCLE_COPY.title}
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
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
