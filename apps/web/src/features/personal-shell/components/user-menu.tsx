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

import SignOut from "@/features/account-access/forms/sign-out";
import { authClient } from "@/lib/auth-client";

import { sessionUser } from "./session-user";

export default function UserMenu() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();
	const user = sessionUser(session);

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
					<DropdownMenuItem
						onClick={() => {
							void navigate({ to: "/sessions" });
						}}
					>
						Sessions
					</DropdownMenuItem>
					<SignOut />
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
