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
import { authClient } from "@/lib/auth-client";

import { sessionUser } from "./session-user";

export default function UserMenu() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();
	const user = sessionUser(session);
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
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				{user.name}
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
					<SignOut />
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
