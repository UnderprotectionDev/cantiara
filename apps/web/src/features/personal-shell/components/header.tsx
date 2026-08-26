import { Link } from "@tanstack/react-router";

import { AppearanceToggle } from "@/features/account-preferences/forms/appearance-toggle";
import { FounderCommandPalette } from "@/features/command-palette/components/founder-command-palette";
import UserMenu from "@/features/personal-shell/components/user-menu";
import { authClient } from "@/lib/auth-client";

import { sessionUser } from "./session-user";

export default function Header() {
	const { data: session } = authClient.useSession();
	const user = sessionUser(session);
	const links = [
		{ label: "Home", to: "/" },
		{ label: "Dashboard", to: "/dashboard" },
		{ label: "Preferences", to: "/account" },
		{ label: "Sessions", to: "/sessions" },
	] as const;

	return (
		<div>
			<div className="flex flex-row items-center justify-between px-2 py-1">
				<nav className="flex gap-4 text-lg">
					{links.map(({ to, label }) => (
						<Link key={to} to={to}>
							{label}
						</Link>
					))}
				</nav>
				<div className="flex items-center gap-2">
					{user ? <FounderCommandPalette /> : null}
					<AppearanceToggle />
					<UserMenu />
				</div>
			</div>
			<hr />
		</div>
	);
}
