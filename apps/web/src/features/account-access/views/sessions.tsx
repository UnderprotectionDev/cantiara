import { unsavedAccountPreferences } from "@cantiara/auth/account-preferences-model";
import { Badge } from "@cantiara/ui/components/badge";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@cantiara/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import RevokeOtherSessions from "@/features/account-access/forms/revoke-other-sessions";
import RevokeSession from "@/features/account-access/forms/revoke-session";
import { sessionLastActivityDisplay } from "@/features/account-access/forms/session-last-activity";
import ExtensionLinks from "@/features/capture-triage/forms/extension-links";
import { orpc } from "@/utils/orpc";

export default function Sessions() {
	const sessions = useQuery(orpc.accountAccess.sessions.queryOptions());
	const preferences = useQuery(orpc.accountPreferences.get.queryOptions());
	const displayPreferences = preferences.data ?? unsavedAccountPreferences();

	return (
		<main className="mx-auto w-full max-w-3xl p-6">
			<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<h1 className="font-bold text-2xl">Sessions</h1>
				<div className="flex flex-wrap items-center gap-3">
					<Link to="/confirm-github-identity">Confirm GitHub Identity</Link>
					<RevokeOtherSessions />
				</div>
			</div>
			{sessions.isPending ? (
				<p>Loading sessions…</p>
			) : (
				<Table>
					<TableCaption>
						Active sessions for this Account, with device and last activity.
					</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead>Device</TableHead>
							<TableHead>Last activity</TableHead>
							<TableHead>Current</TableHead>
							<TableHead>Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{(sessions.data ?? []).map((session) => (
							<TableRow key={session.id}>
								<TableCell>{session.device}</TableCell>
								<TableCell>
									<time dateTime={session.lastActivity}>
										{sessionLastActivityDisplay(
											session.lastActivity,
											displayPreferences
										)}
									</time>
								</TableCell>
								<TableCell>
									{session.current ? (
										<Badge variant="secondary">Current</Badge>
									) : null}
								</TableCell>
								<TableCell>
									<RevokeSession
										current={session.current}
										device={session.device}
										sessionId={session.id}
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
			<ExtensionLinks />
		</main>
	);
}
