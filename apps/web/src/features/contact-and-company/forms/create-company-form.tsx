import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc, queryClient } from "@/utils/orpc";

import { CONTACT_AND_COMPANY_COPY } from "./contact-and-company-copy";

export default function CreateCompanyForm({
	onCreated,
}: {
	onCreated?: (companyId: string) => void;
}) {
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const [error, setError] = useState<string | null>(null);
	const [name, setName] = useState("");
	const create = useMutation(
		orpc.contactAndCompany.createCompany.mutationOptions({
			onSuccess: async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await queryClient.invalidateQueries({
						queryKey: orpc.contactAndCompany.listCompanies.queryKey(),
					});
					onCreated?.(outcome.company.id);
					recordSave();
					setError(null);
					setName("");
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
					payload: { name },
				})
			);
		},
		[attemptOnlineWork, create, markUnsaved, name]
	);
	const onNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setName(event.target.value);
	}, []);

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="company-name">
						{CONTACT_AND_COMPANY_COPY.name}
					</FieldLabel>
					<Input
						id="company-name"
						onChange={onNameChange}
						required
						value={name}
					/>
				</Field>
			</FieldGroup>
			{error ? <p role="alert">{error}</p> : null}
			<Button type="submit">{CONTACT_AND_COMPANY_COPY.createCompany}</Button>
		</form>
	);
}
