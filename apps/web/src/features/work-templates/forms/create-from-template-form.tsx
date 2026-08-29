import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";

import { invalidateCustomFieldValues } from "@/features/custom-fields/forms/custom-field-values-editor";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { workTemplateMutationError } from "./work-template-mutation-error";
import { WORK_TEMPLATE_COPY } from "./work-templates-copy";

function todayStamp(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function CreateFromTemplateForm({
	onCreated,
	projectId,
}: {
	onCreated?: (workId: string) => void;
	projectId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [createDay, setCreateDay] = useState(todayStamp);
	const [error, setError] = useState<string | null>(null);
	const [templateId, setTemplateId] = useState("");
	const templates = useQuery(
		orpc.workTemplates.list.queryOptions({ input: { projectId } })
	);
	const selected = useMemo(
		() => (templates.data ?? []).find((row) => row.id === templateId) ?? null,
		[templateId, templates.data]
	);
	const preview = useQuery({
		...orpc.workTemplates.previewDates.queryOptions({
			input: { createDay, templateId },
		}),
		enabled: templateId.length > 0,
	});
	const instantiate = useMutation(
		orpc.workTemplates.instantiate.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(projectId, outcome.work.id);
					await invalidateCustomFieldValues(projectId, "Work", outcome.work.id);
					await queryClient.invalidateQueries({
						queryKey: orpc.projectShell.get.queryKey({
							input: { projectId },
						}),
					});
					onCreated?.(outcome.work.id);
					recordSave();
					setError(null);
					return;
				}
				const message = workTemplateMutationError(outcome);
				if (message) {
					setError(message);
				}
			},
		})
	);
	const onTemplateChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setTemplateId(event.target.value);
		},
		[]
	);
	const onCreateDayChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setCreateDay(event.target.value);
		},
		[]
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!selected) {
				return;
			}
			setError(null);
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				instantiate.mutateAsync({
					baseRevision: selected.revision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						createDay,
						templateId: selected.id,
					},
				})
			);
		},
		[attemptOnlineWork, createDay, instantiate, markUnsaved, selected]
	);
	const definitions = templates.data ?? [];
	if (definitions.length === 0) {
		return null;
	}
	const previewBody = preview.data;
	const datesBlocked =
		previewBody?.status === "rejected" &&
		(selected?.plannedStartRule !== null || selected?.targetDateRule !== null);

	return (
		<section aria-label={WORK_TEMPLATE_COPY.createFromTemplate}>
			<form className="flex flex-col gap-3" onSubmit={onSubmit}>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="create-from-template">
							{WORK_TEMPLATE_COPY.createFromTemplate}
						</FieldLabel>
						<NativeSelect
							className="w-full"
							id="create-from-template"
							onChange={onTemplateChange}
							value={templateId}
						>
							<NativeSelectOption value="">
								{WORK_TEMPLATE_COPY.workTemplate}
							</NativeSelectOption>
							{definitions.map((definition) => (
								<NativeSelectOption key={definition.id} value={definition.id}>
									{definition.name} · {definition.workType}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel htmlFor="create-from-template-day">
							{WORK_TEMPLATE_COPY.createDay}
						</FieldLabel>
						<Input
							id="create-from-template-day"
							onChange={onCreateDayChange}
							value={createDay}
						/>
					</Field>
				</FieldGroup>
				{selected ? (
					<section aria-label={WORK_TEMPLATE_COPY.previewDates}>
						<h3 className="font-medium text-sm">
							{WORK_TEMPLATE_COPY.previewDates}
						</h3>
						{previewBody?.status === "ok" ? (
							<p className="text-sm">
								{WORK_TEMPLATE_COPY.plannedStart}:{" "}
								{previewBody.preview.plannedStart ?? "—"}
								{" · "}
								{WORK_TEMPLATE_COPY.targetDate}:{" "}
								{previewBody.preview.targetDate ?? "—"}
							</p>
						) : null}
						{previewBody?.status === "rejected" ? (
							<p role="alert">{WORK_TEMPLATE_COPY.relativeDateUnresolved}</p>
						) : null}
					</section>
				) : null}
				<Button
					disabled={instantiate.isPending || !selected || datesBlocked}
					type="submit"
				>
					{WORK_TEMPLATE_COPY.createFromTemplate}
				</Button>
			</form>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}
