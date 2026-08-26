import { formatDateTime } from "@cantiara/auth/account-preferences-format";
import { unsavedAccountPreferences } from "@cantiara/auth/account-preferences-model";
import { Button } from "@cantiara/ui/components/button";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@cantiara/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import RevokeExtensionLink from "@/features/capture-triage/forms/revoke-extension-link";
import { pairingCodeDisplay } from "@/features/capture-triage/forms/web-capture-state";
import { orpc } from "@/utils/orpc";

export default function ExtensionLinks() {
	const catalog = useQuery(orpc.captureInbox.catalog.queryOptions());
	const links = useQuery(orpc.captureInbox.listExtensionLinks.queryOptions());
	const preferences = useQuery(orpc.accountPreferences.get.queryOptions());
	const issue = useMutation(
		orpc.captureInbox.issuePairingCode.mutationOptions()
	);
	const copy = catalog.data?.copy;
	const displayPreferences = preferences.data ?? unsavedAccountPreferences();
	const onGenerate = useCallback(() => {
		issue.mutate(undefined);
	}, [issue]);

	if (!copy) {
		return null;
	}

	return (
		<section className="mt-10 flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-bold text-xl">{copy.extensionLinks}</h2>
				<Button onClick={onGenerate} type="button">
					{copy.generatePairingCode}
				</Button>
			</div>
			{issue.data?.status === "issued" ? (
				<p>
					{copy.pairingCode}: {pairingCodeDisplay(issue.data.code)}
					<br />
					{copy.pairingCodeExpiresOnce}
				</p>
			) : null}
			{links.isPending ? (
				<p>Loading…</p>
			) : (
				<Table>
					<TableCaption>
						Paired browsers that can send Web Capture to Capture Inbox.
					</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead>{copy.device}</TableHead>
							<TableHead>{copy.browser}</TableHead>
							<TableHead>{copy.lastUse}</TableHead>
							<TableHead>{copy.revoke}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{(links.data ?? []).map((link) => (
							<TableRow key={link.id}>
								<TableCell>{link.device}</TableCell>
								<TableCell>{link.browser}</TableCell>
								<TableCell>
									<time dateTime={String(link.lastUsedAt)}>
										{formatDateTime(
											new Date(link.lastUsedAt),
											displayPreferences
										)}
									</time>
								</TableCell>
								<TableCell>
									<RevokeExtensionLink
										browser={link.browser}
										device={link.device}
										linkId={link.id}
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</section>
	);
}
