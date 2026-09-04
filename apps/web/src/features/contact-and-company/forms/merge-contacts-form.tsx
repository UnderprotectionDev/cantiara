import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { CONTACT_AND_COMPANY_COPY } from "./contact-and-company-copy";

type MergeField = "displayName" | "currentCompany";

function mergeFieldLabel(field: string): string {
	if (field === "currentCompany") {
		return CONTACT_AND_COMPANY_COPY.belongsToCompany;
	}
	return CONTACT_AND_COMPANY_COPY.displayName;
}

function companyLabel(company: { name: string } | null): string {
	if (!company) {
		return "—";
	}
	return company.name;
}

function displayLabel(name: string | null): string {
	return name ?? "—";
}

export default function MergeContactsForm({
	candidates,
	onMerged,
	revision,
	survivorId,
}: {
	candidates: Array<{ displayName: string | null; id: string }>;
	onMerged?: (survivorId: string) => void;
	revision: number;
	survivorId: string;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [duplicateId, setDuplicateId] = useState("");
	const previewNeeded = duplicateId.length > 0;
	const preview = useQuery({
		...orpc.contactAndCompany.previewMerge.queryOptions({
			input: { duplicateId, survivorId },
		}),
		enabled: previewNeeded,
	});
	const merge = useMutation(
		orpc.contactAndCompany.merge.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.contactAndCompany.listContacts.queryKey(),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.contactAndCompany.listDuplicateCandidates.queryKey(),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.contactAndCompany.getContact.queryKey({
							input: { contactId: survivorId },
						}),
					});
					onMerged?.(outcome.contact.id);
					recordSave();
					setError(null);
					return;
				}
				if (outcome.status === "rejected") {
					if (outcome.reason === "merge-preview-required") {
						setError(CONTACT_AND_COMPANY_COPY.mergePreview);
						return;
					}
					if (outcome.reason === "merge-conflicts-unresolved") {
						setError(CONTACT_AND_COMPANY_COPY.fieldConflicts);
						return;
					}
				}
				setError("Conflict");
			},
		})
	);
	const form = useForm({
		defaultValues: {
			currentCompany: "survivor" as "survivor" | "duplicate",
			displayName: "survivor" as "survivor" | "duplicate",
		},
		onSubmit: async ({ value }) => {
			setError(null);
			if (!preview.data) {
				setError(CONTACT_AND_COMPANY_COPY.mergePreview);
				return;
			}
			const result = attemptOnlineWork("record-create", () =>
				merge.mutateAsync({
					duplicateBaseRevision: preview.data.duplicate.revision,
					duplicateId,
					fieldChoices: value,
					idempotencyKey: newIdempotencyKey(),
					previewAcknowledged: true,
					survivorBaseRevision: revision,
					survivorId,
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
	const onDuplicateChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setDuplicateId(event.target.value);
		},
		[]
	);
	if (candidates.length === 0) {
		return null;
	}
	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup className="flex-row flex-wrap items-end gap-3">
				<Field className="min-w-48">
					<FieldLabel htmlFor="merge-contacts-duplicate">
						{CONTACT_AND_COMPANY_COPY.mergeContacts}
					</FieldLabel>
					<NativeSelect
						className="w-full"
						id="merge-contacts-duplicate"
						onChange={onDuplicateChange}
						value={duplicateId}
					>
						<NativeSelectOption value="">—</NativeSelectOption>
						{candidates.map((item) => (
							<NativeSelectOption key={item.id} value={item.id}>
								{item.displayName ?? item.id}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Button disabled={merge.isPending || !preview.data} type="submit">
					{CONTACT_AND_COMPANY_COPY.mergeContacts}
				</Button>
			</FieldGroup>
			{preview.data ? (
				<section
					aria-label={CONTACT_AND_COMPANY_COPY.mergePreview}
					className="text-muted-foreground text-sm"
				>
					<h3 className="font-medium text-foreground text-sm">
						{CONTACT_AND_COMPANY_COPY.mergePreview}
					</h3>
					<p>
						{CONTACT_AND_COMPANY_COPY.survivingRecord}{" "}
						{preview.data.survivor.displayName ?? preview.data.survivor.id}
					</p>
					<h4 className="mt-2 font-medium text-foreground text-sm">
						{CONTACT_AND_COMPANY_COPY.fieldConflicts}
					</h4>
					{preview.data.fieldConflicts.length === 0 ? (
						<p>—</p>
					) : (
						preview.data.fieldConflicts.map((conflict) => (
							<form.Field
								key={conflict.field}
								name={conflict.field as MergeField}
							>
								{(field) => (
									<ConflictChoice
										conflict={conflict}
										onChange={field.handleChange}
										preview={preview.data}
										value={field.state.value}
									/>
								)}
							</form.Field>
						))
					)}
					<h4 className="mt-2 font-medium text-foreground text-sm">
						{CONTACT_AND_COMPANY_COPY.emailAliases}
					</h4>
					{preview.data.emailAliases.length === 0 ? (
						<p>—</p>
					) : (
						preview.data.emailAliases.map((alias) => (
							<p key={alias.normalizedEmail}>{alias.originalEmail}</p>
						))
					)}
					<h4 className="mt-2 font-medium text-foreground text-sm">
						{CONTACT_AND_COMPANY_COPY.feedbackHistory}
					</h4>
					{preview.data.relatedFeedback.length === 0 ? (
						<p>—</p>
					) : (
						preview.data.relatedFeedback.map((item) => (
							<p key={item.id}>
								{item.title.length > 0 ? item.title : item.id}
							</p>
						))
					)}
					<h4 className="mt-2 font-medium text-foreground text-sm">
						{CONTACT_AND_COMPANY_COPY.company}
					</h4>
					<p>
						{preview.data.survivor.currentCompany?.name ??
							CONTACT_AND_COMPANY_COPY.none}
					</p>
					<p>
						{preview.data.duplicate.currentCompany?.name ??
							CONTACT_AND_COMPANY_COPY.none}
					</p>
					<h4 className="mt-2 font-medium text-foreground text-sm">
						{CONTACT_AND_COMPANY_COPY.personaRelations}
					</h4>
					{preview.data.relatedPersonaDocuments.length === 0 ? (
						<p>—</p>
					) : (
						preview.data.relatedPersonaDocuments.map((item) => (
							<p key={item.id}>{item.title}</p>
						))
					)}
					<h4 className="mt-2 font-medium text-foreground text-sm">
						{CONTACT_AND_COMPANY_COPY.relationsToRewrite}
					</h4>
					{preview.data.relationsToRewrite.length === 0 ? (
						<p>—</p>
					) : (
						preview.data.relationsToRewrite.map((relation) => (
							<p key={`${relation.fromId}:${relation.toId}:${relation.type}`}>
								{relation.type} {relation.fromId} → {relation.rewrittenFromId}
							</p>
						))
					)}
				</section>
			) : null}
			{error ? <p role="alert">{error}</p> : null}
		</form>
	);
}

function ConflictChoice({
	conflict,
	onChange,
	preview,
	value,
}: {
	conflict: {
		duplicateValue: string;
		field: string;
		survivorValue: string;
	};
	onChange: (value: "survivor" | "duplicate") => void;
	preview: {
		duplicate: {
			currentCompany: { id: string; name: string } | null;
			displayName: string | null;
		};
		survivor: {
			currentCompany: { id: string; name: string } | null;
			displayName: string | null;
		};
	};
	value: "survivor" | "duplicate";
}) {
	const onSelect = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onChange(event.target.value as "survivor" | "duplicate");
		},
		[onChange]
	);
	const survivorLabel =
		conflict.field === "currentCompany"
			? companyLabel(preview.survivor.currentCompany)
			: displayLabel(preview.survivor.displayName);
	const duplicateLabel =
		conflict.field === "currentCompany"
			? companyLabel(preview.duplicate.currentCompany)
			: displayLabel(preview.duplicate.displayName);
	return (
		<Field className="mt-1">
			<FieldLabel htmlFor={`merge-contact-field-${conflict.field}`}>
				{mergeFieldLabel(conflict.field)}
			</FieldLabel>
			<NativeSelect
				className="w-full"
				id={`merge-contact-field-${conflict.field}`}
				onChange={onSelect}
				value={value}
			>
				<NativeSelectOption value="survivor">
					{survivorLabel}
				</NativeSelectOption>
				<NativeSelectOption value="duplicate">
					{duplicateLabel}
				</NativeSelectOption>
			</NativeSelect>
		</Field>
	);
}
