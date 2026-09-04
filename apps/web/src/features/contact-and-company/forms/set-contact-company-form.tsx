import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
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

export default function SetContactCompanyForm({
	companies,
	contactId,
	currentCompanyId,
	revision,
}: {
	companies: Array<{ id: string; name: string }>;
	contactId: string;
	currentCompanyId: string | null;
	revision: number;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [companyId, setCompanyId] = useState(currentCompanyId ?? "");
	const [error, setError] = useState<string | null>(null);
	const setCompany = useMutation(
		orpc.contactAndCompany.setCompany.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.contactAndCompany.getContact.queryKey({
							input: { contactId },
						}),
					});
					await queryClient.invalidateQueries({
						queryKey: orpc.contactAndCompany.listContacts.queryKey(),
					});
					recordSave();
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
				setCompany.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					payload: {
						companyId: companyId.length > 0 ? companyId : null,
						contactId,
					},
				})
			);
		},
		[attemptOnlineWork, companyId, contactId, markUnsaved, revision, setCompany]
	);
	const onCompanyChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setCompanyId(event.target.value);
		},
		[]
	);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<Field>
				<FieldLabel htmlFor="contact-belongs-to-company">
					{CONTACT_AND_COMPANY_COPY.belongsToCompany}
				</FieldLabel>
				<NativeSelect
					id="contact-belongs-to-company"
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
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{CONTACT_AND_COMPANY_COPY.belongsToCompany}</Button>
		</form>
	);
}
