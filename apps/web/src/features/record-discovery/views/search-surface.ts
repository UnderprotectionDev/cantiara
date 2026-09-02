export const SEARCH_SHORTCUTS = {
	open: { ctrlOrMeta: true, key: "/" },
} as const;

export const SEARCH_SHORTCUT_HINT = "Ctrl+/";

export interface SearchKeyEvent {
	ctrlKey: boolean;
	key: string;
	metaKey: boolean;
	repeat?: boolean;
}

export function isSearchOpenShortcut(event: SearchKeyEvent): boolean {
	if (event.repeat) {
		return false;
	}
	if (event.key !== SEARCH_SHORTCUTS.open.key) {
		return false;
	}
	return event.metaKey || event.ctrlKey;
}
