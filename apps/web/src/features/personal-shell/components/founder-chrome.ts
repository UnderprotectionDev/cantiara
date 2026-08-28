export const FOUNDER_CHROME_COPY = {
	account: "Account",
	capture: "Capture",
	drafts: "Drafts",
	personalWiki: "Personal Wiki",
	product: "Cantiara",
	projects: "Projects",
} as const;

export const FOUNDER_CHROME_PATHS = {
	capture: "/capture",
	drafts: "/drafts",
	personalWiki: "/wiki",
	projects: "/projects",
	workspaceHome: "/dashboard",
} as const;

export function founderChromeNav() {
	return [
		{
			label: FOUNDER_CHROME_COPY.capture,
			to: FOUNDER_CHROME_PATHS.capture,
		},
		{
			label: FOUNDER_CHROME_COPY.drafts,
			to: FOUNDER_CHROME_PATHS.drafts,
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
	return ["Preferences", "Sessions"] as const;
}
