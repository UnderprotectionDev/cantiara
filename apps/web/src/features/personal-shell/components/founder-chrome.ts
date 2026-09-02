export const FOUNDER_CHROME_COPY = {
	account: "Account",
	calendar: "Calendar",
	capture: "Capture",
	dailyFocus: "Daily Focus",
	drafts: "Drafts",
	focusPeriod: "Focus Period",
	menu: "Menu",
	personalWiki: "Personal Wiki",
	product: "Cantiara",
	projects: "Projects",
	search: "Search",
	skipToMain: "Skip to main content",
} as const;

export const FOUNDER_MAIN_ID = "main-content";

export const FOUNDER_CHROME_PATHS = {
	calendar: "/calendar",
	capture: "/capture",
	dailyFocus: "/daily-focus",
	drafts: "/drafts",
	focusPeriod: "/focus-periods",
	personalWiki: "/wiki",
	projects: "/projects",
	search: "/search",
	workspaceHome: "/dashboard",
} as const;

export function founderChromeNav() {
	return [
		{
			label: FOUNDER_CHROME_COPY.search,
			to: FOUNDER_CHROME_PATHS.search,
		},
		{
			label: FOUNDER_CHROME_COPY.capture,
			to: FOUNDER_CHROME_PATHS.capture,
		},
		{
			label: FOUNDER_CHROME_COPY.drafts,
			to: FOUNDER_CHROME_PATHS.drafts,
		},
		{
			label: FOUNDER_CHROME_COPY.dailyFocus,
			to: FOUNDER_CHROME_PATHS.dailyFocus,
		},
		{
			label: FOUNDER_CHROME_COPY.calendar,
			to: FOUNDER_CHROME_PATHS.calendar,
		},
		{
			label: FOUNDER_CHROME_COPY.focusPeriod,
			to: FOUNDER_CHROME_PATHS.focusPeriod,
		},
		{
			label: FOUNDER_CHROME_COPY.projects,
			to: FOUNDER_CHROME_PATHS.projects,
		},
		{
			label: FOUNDER_CHROME_COPY.personalWiki,
			to: FOUNDER_CHROME_PATHS.personalWiki,
		},
	] as const;
}

export function founderChromeAccountOnly() {
	return ["Preferences", "Completion effects", "Sessions"] as const;
}

export function founderChromeNavIsCurrent(
	pathname: string,
	to: (typeof FOUNDER_CHROME_PATHS)[keyof typeof FOUNDER_CHROME_PATHS]
): boolean {
	if (to === FOUNDER_CHROME_PATHS.projects) {
		return pathname === to || pathname === "/projects/new";
	}
	return pathname === to;
}

export function projectOverviewHref(projectId: string): string {
	return `/projects/${projectId}#overview`;
}
