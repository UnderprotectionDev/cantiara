import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { CONTACT_AND_COMPANY_COPY } from "./contact-and-company-copy";

export default function CreateContactForm({
	companies,
	onCreated,
}: {
	companies: Array<{ id: string; name: string }>;
	onCreated?: (contactId: string) => void;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [companyId, setCompanyId] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const create = useMutation(
		orpc.contactAndCompany.createContact.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.contactAndCompany.listContacts.queryKey(),
					});
					onCreated?.(outcome.contact.id);
					recordSave();
					setCompanyId("");
					setDisplayName("");
					setEmail("");
					setError(null);
					return;
				}
				if (outcome.status === "rejected") {
					setError(outcome.reason);
				}
			},
		})
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError(null);
			markUnsaved();
			attemptOnlineWork("record-create", () =>
				create.mutateAsync({
					idempotencyKey: newIdempotencyKey(),
					payload: {
						companyId: companyId.length > 0 ? companyId : undefined,
						displayName,
						email,
					},
				})
			);
		},
		[attemptOnlineWork, companyId, create, displayName, email, markUnsaved]
	);
	const onDisplayNameChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setDisplayName(event.target.value);
		},
		[]
	);
	const onEmailChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setEmail(event.target.value);
	}, []);
	const onCompanyChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setCompanyId(event.target.value);
		},
		[]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="contact-display-name">
						{CONTACT_AND_COMPANY_COPY.displayName}
					</FieldLabel>
					<Input
						id="contact-display-name"
						onChange={onDisplayNameChange}
						value={displayName}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="contact-email">
						{CONTACT_AND_COMPANY_COPY.email}
					</FieldLabel>
					<Input
						id="contact-email"
						onChange={onEmailChange}
						type="email"
						value={email}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="contact-company">
						{CONTACT_AND_COMPANY_COPY.belongsToCompany}
					</FieldLabel>
					<NativeSelect
						id="contact-company"
						onChange={onCompanyChange}
						value={companyId}
					>
						<NativeSelectOption value="">
							{CONTACT_AND_COMPANY_COPY.none}
						</NativeSelectOption>
						{companies.map((company) => (
							<NativeSelectOption key={company.id} value={company.id}>
								{company.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{CONTACT_AND_COMPANY_COPY.createContact}</Button>
		</form>
	);
}
