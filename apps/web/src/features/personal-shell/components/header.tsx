import { Link } from "@tanstack/react-router";

import { AppearanceToggle } from "@/features/account-preferences/forms/appearance-toggle";
import {
	CommandPaletteProvider,
	CommandPaletteTrigger,
} from "@/features/command-palette/components/founder-command-palette";
import UserMenu from "@/features/personal-shell/components/user-menu";

export default function Header() {
	const links = [
		{ label: "Home", to: "/" },
		{ label: "Dashboard", to: "/dashboard" },
		{ label: "Create Project", to: "/projects/new" },
	] as const;

	return (
		<div>
			<div className="flex flex-row items-center justify-between gap-3 px-2 py-1">
				<nav className="flex min-w-0 gap-3 text-sm">
					{links.map(({ to, label }) => (
						<Link key={to} to={to}>
							{label}
						</Link>
					))}
				</nav>
				<CommandPaletteProvider>
					<div className="flex min-w-0 shrink-0 items-center gap-2">
						<CommandPaletteTrigger />
						<AppearanceToggle />
						<UserMenu />
					</div>
				</CommandPaletteProvider>
			</div>
			<hr />
		</div>
	);
}
