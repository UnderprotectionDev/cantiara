import { highlight } from "@tanstack/highlight";
import { createThemeCss } from "@tanstack/highlight/theme";
import { githubDarkTheme } from "@tanstack/highlight/themes/github-dark";
import { githubLightTheme } from "@tanstack/highlight/themes/github-light";

export const documentHighlightCss = createThemeCss({
	dark: githubDarkTheme,
	darkSelector: ".dark",
	light: githubLightTheme,
});

export function highlightDocumentCode(
	source: string,
	language: string
): string {
	return highlight(source, { lang: language }).html;
}
