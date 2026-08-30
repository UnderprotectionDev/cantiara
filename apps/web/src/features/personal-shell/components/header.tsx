import { Button } from "@cantiara/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@cantiara/ui/components/dropdown-menu";
import { Skeleton } from "@cantiara/ui/components/skeleton";
import { cn } from "@cantiara/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useCallback } from "react";

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
	FOUNDER_MAIN_ID,
	founderChromeNav,
	founderChromeNavIsCurrent,
	projectOverviewHref,
} from "./founder-chrome";
import { projectIdFromPath } from "./project-id-from-path";

function chromeLinkClass(current: boolean) {
	return cn(
		"rounded-sm px-1 py-0.5 text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
		current
			? "border-foreground border-b-2 font-medium text-foreground"
			: "text-muted-foreground hover:text-foreground"
	);
}

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
	const projectShortCode = project.data?.shortCode;
	const nav = founderChromeNav();

	return (
		<header className="sticky top-0 z-40 border-b bg-background">
			<a
				className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
				href={`#${FOUNDER_MAIN_ID}`}
			>
				{FOUNDER_CHROME_COPY.skipToMain}
			</a>
			<div className="flex h-12 items-center gap-3 px-5">
				<nav
					aria-label={FOUNDER_CHROME_COPY.product}
					className="flex min-w-0 flex-1 items-center gap-3 text-sm"
				>
					<Link
						className="truncate font-semibold text-foreground tracking-tight focus-visible:ring-2 focus-visible:ring-ring"
						to={FOUNDER_CHROME_PATHS.workspaceHome}
					>
						{FOUNDER_CHROME_COPY.product}
					</Link>
					{projectId && !projectName ? <Skeleton className="h-4 w-24" /> : null}
					{projectId && projectName ? (
						<>
							<span aria-hidden="true" className="text-border">
								/
							</span>
							<a
								aria-current="page"
								className="min-w-0 truncate text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
								href={projectOverviewHref(projectId)}
							>
								<span>{projectName}</span>
								{projectShortCode ? (
									<span className="sr-only">{` ${projectShortCode}`}</span>
								) : null}
							</a>
						</>
					) : null}
					<span aria-hidden="true" className="h-4 w-px bg-border" />
					<div className="hidden min-w-0 items-center gap-3 md:flex">
						{nav.map(({ to, label }) => {
							const current = founderChromeNavIsCurrent(pathname, to);
							return (
								<Link
									aria-current={current ? "page" : undefined}
									className={chromeLinkClass(current)}
									key={to}
									to={to}
								>
									{label}
								</Link>
							);
						})}
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button className="md:hidden" size="sm" variant="ghost" />
							}
						>
							<Menu className="size-4" />
							{FOUNDER_CHROME_COPY.menu}
						</DropdownMenuTrigger>
						<DropdownMenuContent className="bg-card">
							{nav.map(({ to, label }) => (
								<ChromeMenuItem
									current={founderChromeNavIsCurrent(pathname, to)}
									key={to}
									label={label}
									to={to}
								/>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
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

function ChromeMenuItem({
	current,
	label,
	to,
}: {
	current: boolean;
	label: string;
	to: (typeof FOUNDER_CHROME_PATHS)[keyof typeof FOUNDER_CHROME_PATHS];
}) {
	const navigate = useNavigate();
	const onClick = useCallback(() => {
		navigate({ to }).catch(() => undefined);
	}, [navigate, to]);
	return (
		<DropdownMenuItem
			aria-current={current ? "page" : undefined}
			onClick={onClick}
		>
			{label}
		</DropdownMenuItem>
	);
}
