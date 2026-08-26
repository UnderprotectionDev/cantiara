import { Button } from "@cantiara/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { MUTATION_COPY, newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { copyProjectStructureError } from "./copy-project-error";
import {
	PROJECT_SHELL_COPY,
	structureCopyPreviewItems,
} from "./project-shell-copy";

export default function CopyProjectStructureForm({
	projectId,
}: {
	projectId: string;
}) {
	const navigate = useNavigate();
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [open, setOpen] = useState(false);
	const [shortCodeTouched, setShortCodeTouched] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const preview = useQuery({
		...orpc.projectShell.previewCopyStructure.queryOptions({
			input: { projectId },
		}),
		enabled: open,
	});
	const copy = useMutation(
		orpc.projectShell.copyStructure.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.projectShell.list.queryKey(),
					});
					recordSave();
					setOpen(false);
					await navigate({
						params: { projectId: outcome.project.id },
						to: "/projects/$projectId",
					});
					return;
				}
				const message = copyProjectStructureError(outcome);
				if (message) {
					setError(message);
				}
			},
		})
	);
	const form = useForm({
		defaultValues: { name: "", shortCode: "" },
		onSubmit: async ({ value }) => {
			setError(null);
			const result = attemptOnlineWork("record-create", () =>
				copy.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						name: value.name,
						shortCode: value.shortCode || undefined,
						sourceProjectId: projectId,
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
		enabled: open && name.trim().length > 0 && !shortCodeTouched,
	});

	useEffect(() => {
		if (!open) {
			setShortCodeTouched(false);
			setError(null);
			form.reset();
		}
	}, [form, open]);

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
	const onOpenChange = useCallback((next: boolean) => {
		setOpen(next);
	}, []);
	const onOpen = useCallback(() => {
		setOpen(true);
	}, []);
	const onCancel = useCallback(() => {
		setOpen(false);
	}, []);

	return (
		<>
			<Button onClick={onOpen} type="button" variant="outline">
				{PROJECT_SHELL_COPY.copyProjectStructure}
			</Button>
			<Dialog onOpenChange={onOpenChange} open={open}>
				<DialogContent
					aria-label={PROJECT_SHELL_COPY.copyProjectStructure}
					className="sm:max-w-lg"
				>
					<form className="flex flex-col gap-4" onSubmit={onSubmit}>
						<DialogHeader>
							<DialogTitle>
								{PROJECT_SHELL_COPY.copyProjectStructure}
							</DialogTitle>
						</DialogHeader>
						{preview.data ? (
							<div>
								{structureCopyPreviewItems(preview.data).map((section) => (
									<section aria-label={section.label} key={section.label}>
										<h3>{section.label}</h3>
										<ul>
											{section.items.map((item) => (
												<li key={item}>{item}</li>
											))}
										</ul>
									</section>
								))}
							</div>
						) : null}
						<FieldGroup>
							<form.Field name="name">
								{(field) => (
									<TextField
										id="copy-project-name"
										label={PROJECT_SHELL_COPY.projectName}
										onValueChange={field.handleChange}
										required={true}
										value={field.state.value}
									/>
								)}
							</form.Field>
							<form.Field name="shortCode">
								{(field) => (
									<TextField
										id="copy-short-code"
										label={PROJECT_SHELL_COPY.shortCode}
										maxLength={6}
										onValueChange={onShortCodeChange}
										value={field.state.value}
									/>
								)}
							</form.Field>
						</FieldGroup>
						{error ? <p role="alert">{error}</p> : null}
						<DialogFooter>
							<Button onClick={onCancel} type="button" variant="outline">
								{MUTATION_COPY.cancel}
							</Button>
							<Button disabled={copy.isPending} type="submit">
								{PROJECT_SHELL_COPY.copyProjectStructure}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}

function TextField({
	id,
	label,
	maxLength,
	onValueChange,
	required,
	value,
}: {
	id: string;
	label: string;
	maxLength?: number;
	onValueChange: (value: string) => void;
	required?: boolean;
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
				type="text"
				value={value}
			/>
		</Field>
	);
}
