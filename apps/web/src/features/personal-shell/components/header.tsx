import { Button } from "@cantiara/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@cantiara/ui/components/dropdown-menu";
import { Skeleton } from "@cantiara/ui/components/skeleton";
import { cn } from "@cantiara/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Fragment, useCallback } from "react";

import { AppearanceToggle } from "@/features/account-preferences/forms/appearance-toggle";
import { shouldRenderFounderPalette } from "@/features/command-palette/command-palette";
import {
	CommandPaletteProvider,
	CommandPaletteTrigger,
	usePaletteSurface,
} from "@/features/command-palette/components/founder-command-palette";
import UserMenu from "@/features/personal-shell/components/user-menu";
import { RECORD_DISCOVERY_COPY } from "@/features/record-discovery/views/record-discovery-copy";
import { SearchOverlay } from "@/features/record-discovery/views/search-overlay";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

import {
	FOUNDER_CHROME_COPY,
	FOUNDER_CHROME_PATHS,
	FOUNDER_MAIN_ID,
	type FounderChromePath,
	founderChromeMoreNavGroups,
	founderChromeNavIsCurrent,
	founderChromePrimaryNav,
	projectOverviewHref,
} from "./founder-chrome";
import { projectIdFromPath } from "./project-id-from-path";

function chromeLinkClass(current: boolean) {
	return cn(
		"rounded-none px-1.5 py-0.5 text-sm transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:opacity-80",
		current
			? "border-foreground border-b-2 font-medium text-foreground"
			: "text-muted-foreground hover:text-foreground"
	);
}

function chromeSearch(to: FounderChromePath) {
	return to === FOUNDER_CHROME_PATHS.table
		? { kind: RECORD_DISCOVERY_COPY.work }
		: undefined;
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
	const primary = founderChromePrimaryNav();
	const moreGroups = founderChromeMoreNavGroups();
	const moreCurrent = moreGroups.some((group) =>
		group.some(({ to }) => founderChromeNavIsCurrent(pathname, to))
	);

	return (
		<header className="sticky top-0 z-40 border-b bg-background">
			<a
				className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
				href={`#${FOUNDER_MAIN_ID}`}
			>
				{FOUNDER_CHROME_COPY.skipToMain}
			</a>
			<div className="flex h-12 items-center gap-3 px-4">
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
					<div className="hidden min-w-0 items-center gap-1 md:flex">
						{primary.map(({ to, label }) => {
							const current = founderChromeNavIsCurrent(pathname, to);
							return (
								<Link
									aria-current={current ? "page" : undefined}
									className={chromeLinkClass(current)}
									key={to}
									search={chromeSearch(to)}
									to={to}
								>
									{label}
								</Link>
							);
						})}
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										aria-current={moreCurrent ? "page" : undefined}
										className={cn(
											"h-7 px-1.5 font-normal",
											moreCurrent
												? "border-foreground border-b-2 font-medium text-foreground"
												: "text-muted-foreground"
										)}
										size="sm"
										variant="ghost"
									/>
								}
							>
								{FOUNDER_CHROME_COPY.more}
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="bg-card">
								{moreGroups.map((group, groupIndex) => (
									<Fragment key={group.map((item) => item.to).join("-")}>
										{groupIndex > 0 ? <DropdownMenuSeparator /> : null}
										<DropdownMenuGroup>
											{group.map(({ to, label }) => (
												<ChromeMenuItem
													current={founderChromeNavIsCurrent(pathname, to)}
													key={to}
													label={label}
													to={to}
												/>
											))}
										</DropdownMenuGroup>
									</Fragment>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
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
							<DropdownMenuGroup>
								{primary.map(({ to, label }) => (
									<ChromeMenuItem
										current={founderChromeNavIsCurrent(pathname, to)}
										key={to}
										label={label}
										to={to}
									/>
								))}
							</DropdownMenuGroup>
							{moreGroups.map((group) => (
								<Fragment key={group.map((item) => item.to).join("-")}>
									<DropdownMenuSeparator />
									<DropdownMenuGroup>
										{group.map(({ to, label }) => (
											<ChromeMenuItem
												current={founderChromeNavIsCurrent(pathname, to)}
												key={to}
												label={label}
												to={to}
											/>
										))}
									</DropdownMenuGroup>
								</Fragment>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</nav>
				<CommandPaletteProvider>
					<div className="flex shrink-0 items-center gap-1">
						<SearchOverlay />
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
	to: FounderChromePath;
}) {
	const navigate = useNavigate();
	const onClick = useCallback(() => {
		if (to === FOUNDER_CHROME_PATHS.table) {
			navigate({
				search: { kind: RECORD_DISCOVERY_COPY.work },
				to,
			}).catch(() => undefined);
			return;
		}
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
