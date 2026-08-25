import type {
	AccountPreferences,
	AccountPreferencesInput,
	SuggestedLocaleAndTimeZone,
} from "@cantiara/auth/account-preferences";
import {
	ACCOUNT_PREFERENCES_COPY,
	applySuggestedLocaleAndTimeZone,
	DATE_FORMAT_COPY,
	DATE_FORMATS,
	FIRST_DAYS_OF_WEEK,
	formatDate,
	formatDateTime,
	formatNumber,
	localeSelectOptions,
	shouldShowLocaleTimeZoneSuggestion,
	timeZoneOptions,
	weekdayHeaders,
} from "@cantiara/auth/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { orpc, queryClient } from "@/utils/orpc";

const PREVIEW_INSTANT = new Date("2026-03-29T12:00:00.000Z");
const HISTORICAL_INSTANT = new Date("2026-03-29T21:00:00.000Z");
const PREVIEW_NUMBER = 1234.5;
const WORK_TITLE = "Ship the capture inbox";

export default function PreferencesForm({
	preferences,
	suggestion,
}: {
	preferences: AccountPreferences;
	suggestion: SuggestedLocaleAndTimeZone;
}) {
	const timeZones = useMemo(() => timeZoneOptions(), []);
	const save = useMutation(
		orpc.accountPreferences.save.mutationOptions({
			onError: (error) => {
				toast.error(`Error: ${error.message}`);
			},
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.accountPreferences.get.queryKey(),
				});
				toast.success(ACCOUNT_PREFERENCES_COPY.saved);
			},
		})
	);
	const form = useForm({
		defaultValues: {
			dateFormat: preferences.dateFormat,
			firstDayOfWeek: preferences.firstDayOfWeek,
			locale: preferences.locale,
			timeZone: preferences.timeZone,
		} satisfies AccountPreferencesInput,
		onSubmit: async ({ value }) => {
			await save.mutateAsync(value);
		},
	});
	const values = useStore(form.store, (state) => state.values);
	const locales = localeSelectOptions(preferences.locale, suggestion.locale);
	const showSuggestion = shouldShowLocaleTimeZoneSuggestion(preferences);

	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			form.handleSubmit().catch(() => undefined);
		},
		[form]
	);
	const onUseSuggested = useCallback(() => {
		const next = applySuggestedLocaleAndTimeZone(
			{ ...form.state.values, saved: false },
			suggestion
		);
		form.setFieldValue("locale", next.locale);
		form.setFieldValue("timeZone", next.timeZone);
	}, [form, suggestion]);

	return (
		<form className="flex flex-col gap-6" onSubmit={onSubmit}>
			{showSuggestion ? (
				<div className="flex flex-col gap-2 rounded-none border border-border p-3">
					<p className="text-sm">
						{suggestion.locale} · {suggestion.timeZone}
					</p>
					<Button onClick={onUseSuggested} type="button" variant="outline">
						{ACCOUNT_PREFERENCES_COPY.useSuggested}
					</Button>
				</div>
			) : null}
			<FieldGroup>
				<form.Field name="locale">
					{(field) => (
						<PreferenceSelect
							id="locale"
							label={ACCOUNT_PREFERENCES_COPY.locale}
							onValueChange={field.handleChange}
							value={field.state.value}
						>
							{locales.map((locale) => (
								<NativeSelectOption key={locale} value={locale}>
									{locale}
								</NativeSelectOption>
							))}
						</PreferenceSelect>
					)}
				</form.Field>
				<form.Field name="timeZone">
					{(field) => (
						<PreferenceSelect
							id="time-zone"
							label={ACCOUNT_PREFERENCES_COPY.timeZone}
							onValueChange={field.handleChange}
							value={field.state.value}
						>
							{timeZones.map((timeZone) => (
								<NativeSelectOption key={timeZone} value={timeZone}>
									{timeZone}
								</NativeSelectOption>
							))}
						</PreferenceSelect>
					)}
				</form.Field>
				<form.Field name="dateFormat">
					{(field) => (
						<PreferenceSelect
							id="date-format"
							label={ACCOUNT_PREFERENCES_COPY.dateFormat}
							onValueChange={field.handleChange}
							value={field.state.value}
						>
							{DATE_FORMATS.map((dateFormat) => (
								<NativeSelectOption key={dateFormat} value={dateFormat}>
									{DATE_FORMAT_COPY[dateFormat]}
								</NativeSelectOption>
							))}
						</PreferenceSelect>
					)}
				</form.Field>
				<form.Field name="firstDayOfWeek">
					{(field) => (
						<PreferenceSelect
							id="first-day-of-week"
							label={ACCOUNT_PREFERENCES_COPY.firstDayOfWeek}
							onValueChange={field.handleChange}
							value={field.state.value}
						>
							{FIRST_DAYS_OF_WEEK.map((day) => (
								<NativeSelectOption key={day} value={day}>
									{day}
								</NativeSelectOption>
							))}
						</PreferenceSelect>
					)}
				</form.Field>
			</FieldGroup>
			<PreferencesPreview values={values} />
			<Button disabled={save.isPending} type="submit">
				{ACCOUNT_PREFERENCES_COPY.save}
			</Button>
		</form>
	);
}

function PreferenceSelect<T extends string>({
	children,
	id,
	label,
	onValueChange,
	value,
}: {
	children: ReactNode;
	id: string;
	label: string;
	onValueChange: (value: T) => void;
	value: T;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange(event.target.value as T);
		},
		[onValueChange]
	);

	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<NativeSelect
				className="w-full"
				id={id}
				onChange={onChange}
				value={value}
			>
				{children}
			</NativeSelect>
		</Field>
	);
}

function PreferencesPreview({ values }: { values: AccountPreferencesInput }) {
	return (
		<section
			aria-label={ACCOUNT_PREFERENCES_COPY.preview}
			className="flex flex-col gap-2 text-sm"
		>
			<p>
				{ACCOUNT_PREFERENCES_COPY.date} {formatDate(PREVIEW_INSTANT, values)}
			</p>
			<p>
				{ACCOUNT_PREFERENCES_COPY.number} {formatNumber(PREVIEW_NUMBER, values)}
			</p>
			<p>
				{ACCOUNT_PREFERENCES_COPY.week} {weekdayHeaders(values).join(" ")}
			</p>
			<p>
				{ACCOUNT_PREFERENCES_COPY.historicalEvent}{" "}
				{formatDateTime(HISTORICAL_INSTANT, values)}
			</p>
			<p>
				{ACCOUNT_PREFERENCES_COPY.workTitle} {WORK_TITLE}
			</p>
		</section>
	);
}
