import { Skeleton } from "@cantiara/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";

import { AppearanceToggle } from "@/features/account-preferences/forms/appearance-toggle";
import { shouldRenderFounderPalette } from "@/features/command-palette/command-palette";
import {
	CommandPaletteProvider,
	CommandPaletteTrigger,
	usePaletteSurface,
} from "@/features/command-palette/components/founder-command-palette";
import UserMenu from "@/features/personal-shell/components/user-menu";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

import {
	FOUNDER_CHROME_COPY,
	FOUNDER_CHROME_PATHS,
	founderChromeNav,
} from "./founder-chrome";
import { projectIdFromPath } from "./project-id-from-path";

export default function Header() {
	const surface = usePaletteSurface();
	const { data: session } = authClient.useSession();
	const signedIn = Boolean(session?.user);
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const projectId = projectIdFromPath(pathname);
	const project = useQuery({
		...orpc.projectShell.get.queryOptions({
			input: { projectId: projectId ?? "" },
		}),
		enabled: Boolean(projectId),
	});

	if (!shouldRenderFounderPalette(surface, signedIn)) {
		return null;
	}

	const projectName = project.data?.name;

	return (
		<header className="sticky top-0 z-40 border-b bg-background">
			<div className="flex h-12 items-center gap-3 px-5">
				<nav
					aria-label={FOUNDER_CHROME_COPY.product}
					className="flex min-w-0 flex-1 items-center gap-3 text-sm"
				>
					<Link
						className="truncate font-semibold tracking-tight text-foreground"
						to={FOUNDER_CHROME_PATHS.workspaceHome}
					>
						{FOUNDER_CHROME_COPY.product}
					</Link>
					{projectId && !projectName ? (
						<Skeleton className="h-4 w-24" />
					) : null}
					{projectName ? (
						<>
							<span aria-hidden="true" className="text-border">
								/
							</span>
							<span className="truncate text-muted-foreground">
								{projectName}
							</span>
						</>
					) : null}
					<span aria-hidden="true" className="h-4 w-px bg-border" />
					{founderChromeNav().map(({ to, label }) => (
						<Link
							className="text-muted-foreground transition-colors hover:text-foreground"
							key={to}
							to={to}
						>
							{label}
						</Link>
					))}
				</nav>
				<CommandPaletteProvider>
					<div className="flex shrink-0 items-center gap-1">
						<CommandPaletteTrigger />
						<AppearanceToggle />
						<UserMenu />
					</div>
				</CommandPaletteProvider>
			</div>
		</header>
	);
}
