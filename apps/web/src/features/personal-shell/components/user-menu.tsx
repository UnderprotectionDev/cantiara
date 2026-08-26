import { Button } from "@cantiara/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@cantiara/ui/components/dropdown-menu";
import { Skeleton } from "@cantiara/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import SignOut from "@/features/account-access/forms/sign-out";
import { COMMAND_PALETTE_COPY } from "@/features/command-palette/command-palette-copy";
import { useCommandPaletteActions } from "@/features/command-palette/components/founder-command-palette";
import { authClient } from "@/lib/auth-client";

import { sessionUser } from "./session-user";

export default function UserMenu() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();
	const user = sessionUser(session);
	const palette = useCommandPaletteActions();
	const onPreferences = useCallback(() => {
		navigate({ to: "/account" }).catch(() => undefined);
	}, [navigate]);
	const onSessions = useCallback(() => {
		navigate({ to: "/sessions" }).catch(() => undefined);
	}, [navigate]);

	if (isPending) {
		return <Skeleton className="h-9 w-24" />;
	}

	if (!user) {
		return (
			<Link to="/login">
				<Button variant="outline">Sign In</Button>
			</Link>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button className="min-w-0 max-w-40" variant="outline" />}
			>
				<span className="truncate">{user.name}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="bg-card">
				<DropdownMenuGroup>
					<DropdownMenuLabel>My Account</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem>{user.email}</DropdownMenuItem>
					<DropdownMenuItem onClick={onPreferences}>
						Preferences
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onSessions}>Sessions</DropdownMenuItem>
					{palette ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuLabel>
								{COMMAND_PALETTE_COPY.title}
							</DropdownMenuLabel>
							<DropdownMenuItem onClick={palette.openCreate}>
								{COMMAND_PALETTE_COPY.create}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={palette.openSwitchProject}>
								{COMMAND_PALETTE_COPY.switchProject}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={palette.openRecord}>
								{COMMAND_PALETTE_COPY.open}
							</DropdownMenuItem>
							{palette.canUndo && palette.undoLabel ? (
								<DropdownMenuItem onClick={palette.undoLast}>
									{palette.undoLabel}
								</DropdownMenuItem>
							) : null}
						</>
					) : null}
					<DropdownMenuSeparator />
					<SignOut />
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
