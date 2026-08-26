export const COMMAND_PALETTE_COPY = {
	cantRunThisHere: "Can't run this here",
	create: "Create",
	noMatchingCommand: "No matching command",
	open: "Open",
	switchProject: "Switch Project",
	title: "Command Palette",
} as const;

export const COMMAND_PALETTE_SHORTCUTS = {
	open: { ctrlOrMeta: true, key: "k" },
} as const;

export const PALETTE_VISIBILITY_BUDGET_MS = {
	p95: 150,
	p99: 300,
} as const;

export const COMMAND_PALETTE_SHORTCUT_HINT = "Ctrl+K";
