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

import RevokeOtherSessions from "@/features/account-access/forms/revoke-other-sessions";
import RevokeSession from "@/features/account-access/forms/revoke-session";
import { orpc } from "@/utils/orpc";

const lastActivityFormat = new Intl.DateTimeFormat("en-GB", {
	dateStyle: "medium",
	timeStyle: "short",
});

export default function Sessions() {
	const sessions = useQuery(orpc.accountAccess.sessions.queryOptions());

	return (
		<main className="mx-auto w-full max-w-3xl p-6">
			<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<h1 className="font-bold text-2xl">Sessions</h1>
				<RevokeOtherSessions />
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
							<TableHead>Status</TableHead>
							<TableHead>Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{(sessions.data ?? []).map((session) => (
							<TableRow key={session.id}>
								<TableCell>{session.device}</TableCell>
								<TableCell>
									<time dateTime={session.lastActivity}>
										{lastActivityFormat.format(new Date(session.lastActivity))}
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
		</main>
	);
}
