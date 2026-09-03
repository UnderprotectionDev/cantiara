import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import {
	PERSONAL_REMINDER_ACTIONS,
	PERSONAL_REMINDERS_COPY,
	type PersonalReminderAction,
} from "./personal-reminders-copy";

interface ReminderRow {
	createdByAction: PersonalReminderAction;
	fireAt: string;
	id: string;
	life: string;
}

function invalidateReminders(sourceId: string, sourceType: string) {
	return queryClient.invalidateQueries({
		predicate: (query) => {
			const serialized = JSON.stringify(query.queryKey);
			return (
				serialized.includes("personalReminders") &&
				serialized.includes(sourceId) &&
				serialized.includes(sourceType)
			);
		},
	});
}

function fireAtLocalValue(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function PersonalReminderPanel({
	sourceId,
	sourceType,
}: {
	sourceId: string;
	sourceType: "Document" | "Work";
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const listed = useQuery(
		orpc.personalReminders.listForSource.queryOptions({
			input: { sourceId, sourceType },
		})
	);
	const create = useMutation(
		orpc.personalReminders.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed") {
					await invalidateReminders(sourceId, sourceType);
					recordSave();
					setError(null);
					return;
				}
				if (outcome.status === "invalid") {
					setError(outcome.reason);
					return;
				}
				setError("Conflict");
			},
		})
	);
	const cancel = useMutation(
		orpc.personalReminders.cancel.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed") {
					await invalidateReminders(sourceId, sourceType);
					recordSave();
					setError(null);
					return;
				}
				setError("Conflict");
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			markUnsaved();
			const form = new FormData(event.currentTarget);
			const local = String(form.get("fireAt") ?? "");
			const createdByAction = String(
				form.get("createdByAction") ?? PERSONAL_REMINDERS_COPY.remindMe
			) as PersonalReminderAction;
			const fireAt = local === "" ? "" : new Date(local).toISOString();
			const result = attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					createdByAction,
					fireAt,
					idempotencyKey: newIdempotencyKey(),
					sourceId,
					sourceType,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, create, markUnsaved, sourceId, sourceType]
	);
	const onCancel = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			markUnsaved();
			const form = new FormData(event.currentTarget);
			const reminderId = String(form.get("reminderId") ?? "");
			const result = attemptOnlineWork("record-create", () =>
				cancel.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					reminderId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			result.value.catch(() => undefined);
		},
		[attemptOnlineWork, cancel, markUnsaved]
	);
	const reminders = (listed.data ?? []) as ReminderRow[];
	return (
		<section className="flex flex-col gap-3">
			<form className="flex flex-col gap-3" onSubmit={onSubmit}>
				<Field>
					<FieldLabel htmlFor={`${sourceId}-reminder-action`}>
						{PERSONAL_REMINDERS_COPY.remindMe}
					</FieldLabel>
					<NativeSelect
						defaultValue={PERSONAL_REMINDERS_COPY.remindMe}
						id={`${sourceId}-reminder-action`}
						name="createdByAction"
					>
						{PERSONAL_REMINDER_ACTIONS.map((action) => (
							<NativeSelectOption key={action} value={action}>
								{action}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${sourceId}-reminder-when`}>
						{PERSONAL_REMINDERS_COPY.fireAt}
					</FieldLabel>
					<Input
						id={`${sourceId}-reminder-when`}
						name="fireAt"
						required
						type="datetime-local"
					/>
				</Field>
				<Button size="sm" type="submit">
					{PERSONAL_REMINDERS_COPY.remindMe}
				</Button>
			</form>
			{error ? <p role="alert">{error}</p> : null}
			{reminders.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{PERSONAL_REMINDERS_COPY.empty}
				</p>
			) : (
				<ul className="flex flex-col gap-2">
					{reminders.map((reminder) => (
						<li
							className="flex flex-wrap items-center gap-2 text-sm"
							key={reminder.id}
						>
							<span>{reminder.life}</span>
							<span>{reminder.createdByAction}</span>
							<time dateTime={reminder.fireAt}>
								{fireAtLocalValue(reminder.fireAt)}
							</time>
							{reminder.life === PERSONAL_REMINDERS_COPY.planned ? (
								<form onSubmit={onCancel}>
									<input name="reminderId" type="hidden" value={reminder.id} />
									<Button size="sm" type="submit" variant="outline">
										{PERSONAL_REMINDERS_COPY.cancel}
									</Button>
								</form>
							) : null}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
