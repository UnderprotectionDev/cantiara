import { Button } from "@cantiara/ui/components/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import {
	PROJECT_SHELL_COPY,
	STARTER_CONFIGURATIONS,
	type StarterConfiguration,
} from "./project-shell-copy";

interface CreateProjectValues {
	logoFileName: string;
	name: string;
	problem: string;
	purpose: string;
	scope: string;
	shortCode: string;
	starterConfiguration: StarterConfiguration;
	targetDate: string;
}

const EMPTY_VALUES: CreateProjectValues = {
	logoFileName: "",
	name: "",
	problem: "",
	purpose: "",
	scope: "",
	shortCode: "",
	starterConfiguration: "Blank Project",
	targetDate: "",
};

export default function CreateProjectForm() {
	const navigate = useNavigate();
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [shortCodeTouched, setShortCodeTouched] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const create = useMutation(
		orpc.projectShell.create.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.projectShell.list.queryKey(),
					});
					recordSave();
					await navigate({
						params: { projectId: outcome.project.id },
						to: "/projects/$projectId",
					});
				}
				if (outcome.status === "rejected" || outcome.status === "conflict") {
					setError(
						outcome.status === "conflict"
							? "Conflict"
							: PROJECT_SHELL_COPY.projectName
					);
				}
			},
		})
	);
	const form = useForm({
		defaultValues: EMPTY_VALUES,
		onSubmit: async ({ value }) => {
			setError(null);
			const result = attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						logoFileName: value.logoFileName || null,
						name: value.name,
						problem: value.problem || undefined,
						purpose: value.purpose || undefined,
						scope: value.scope || undefined,
						shortCode: value.shortCode || undefined,
						starterConfiguration: value.starterConfiguration,
						targetDate: value.targetDate || null,
					},
				})
			);
			if (result.status === "refused") {
				return;
			}
			await result.value;
		},
	});
	const name = useStore(form.store, (state) => state.values.name);
	const suggest = useQuery({
		...orpc.projectShell.suggestShortCode.queryOptions({
			input: { name },
		}),
		enabled: name.trim().length > 0 && !shortCodeTouched,
	});

	useEffect(() => {
		if (shortCodeTouched || !suggest.data?.shortCode) {
			return;
		}
		form.setFieldValue("shortCode", suggest.data.shortCode);
	}, [form, shortCodeTouched, suggest.data?.shortCode]);

	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			markUnsaved();
			form.handleSubmit().catch(() => undefined);
		},
		[form, markUnsaved]
	);
	const onShortCodeChange = useCallback(
		(value: string) => {
			setShortCodeTouched(true);
			form.setFieldValue("shortCode", value);
		},
		[form]
	);

	return (
		<form
			aria-describedby={error ? "create-project-error" : undefined}
			className="flex flex-col gap-6"
			onSubmit={onSubmit}
		>
			{error ? (
				<FieldError id="create-project-error" tabIndex={-1}>
					{error}
				</FieldError>
			) : null}
			<FieldGroup>
				<form.Field name="name">
					{(field) => (
						<TextField
							id="project-name"
							label={PROJECT_SHELL_COPY.projectName}
							onValueChange={field.handleChange}
							required={true}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="starterConfiguration">
					{(field) => (
						<ConfigurationSelect
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="shortCode">
					{(field) => (
						<TextField
							id="short-code"
							label={PROJECT_SHELL_COPY.shortCode}
							maxLength={6}
							onValueChange={onShortCodeChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="purpose">
					{(field) => (
						<OptionalTextarea
							id="purpose"
							label={PROJECT_SHELL_COPY.purpose}
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="problem">
					{(field) => (
						<OptionalTextarea
							id="problem"
							label={PROJECT_SHELL_COPY.problem}
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="scope">
					{(field) => (
						<OptionalTextarea
							id="scope"
							label={PROJECT_SHELL_COPY.scope}
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="targetDate">
					{(field) => (
						<TextField
							id="target-date"
							label={PROJECT_SHELL_COPY.targetDate}
							onValueChange={field.handleChange}
							type="date"
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="logoFileName">
					{(field) => <LogoField onValueChange={field.handleChange} />}
				</form.Field>
			</FieldGroup>
			<Button disabled={create.isPending} type="submit">
				{PROJECT_SHELL_COPY.createProject}
			</Button>
		</form>
	);
}

function TextField({
	id,
	label,
	maxLength,
	onValueChange,
	required,
	type,
	value,
}: {
	id: string;
	label: string;
	maxLength?: number;
	onValueChange: (value: string) => void;
	required?: boolean;
	type?: string;
	value: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input
				id={id}
				maxLength={maxLength}
				onChange={onChange}
				required={required}
				type={type}
				value={value}
			/>
		</Field>
	);
}

function ConfigurationSelect({
	onValueChange,
	value,
}: {
	onValueChange: (value: StarterConfiguration) => void;
	value: StarterConfiguration;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onValueChange(event.target.value as StarterConfiguration);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor="starter-configuration">
				{PROJECT_SHELL_COPY.starterConfiguration}
			</FieldLabel>
			<NativeSelect
				className="w-full"
				id="starter-configuration"
				onChange={onChange}
				required={true}
				value={value}
			>
				{STARTER_CONFIGURATIONS.map((configuration) => (
					<NativeSelectOption key={configuration} value={configuration}>
						{configuration}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}

function OptionalTextarea({
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
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Textarea id={id} onChange={onChange} value={value} />
		</Field>
	);
}

function LogoField({
	onValueChange,
}: {
	onValueChange: (value: string) => void;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onValueChange(event.target.files?.[0]?.name ?? "");
		},
		[onValueChange]
	);
	return (
		<Field>
			<FieldLabel htmlFor="logo">{PROJECT_SHELL_COPY.logo}</FieldLabel>
			<Input id="logo" onChange={onChange} type="file" />
		</Field>
	);
}
