/**
 * Command Palette seam — founder keyboard commands, authorized
 * search/create/switch, visible counterparts, and visibility budget.
 * docs/specs/05-command-palette/spec.md and
 * docs/prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari
 * (Komut Paleti).
 */
import { expect, test } from "vitest";

import {
	type CommandPaletteInput,
	createCommandPalette,
	emptyFounderPaletteInput,
	isPaletteOpenShortcut,
	type PaletteMutationApplyInput,
	type PaletteMutationPort,
	type PaletteSnapshot,
	shouldMountFounderPalette,
	visitorDocumentMountsFounderPalette,
} from "./command-palette";
import {
	COMMAND_PALETTE_COPY,
	COMMAND_PALETTE_SHORTCUT_HINT,
	PALETTE_VISIBILITY_BUDGET_MS,
} from "./command-palette-copy";

const SEARCH_TITLE = /"Search"/;

const OPEN_KEY = {
	ctrlKey: true,
	key: "k",
	metaKey: false,
} as const;

const ATLAS = {
	id: "project-atlas",
	name: "Atlas",
	workspaceId: "ws-home",
} as const;

const NOVA = {
	id: "project-nova",
	name: "Nova",
	workspaceId: "ws-home",
} as const;

const OTHER_WORKSPACE_PROJECT = {
	id: "project-foreign",
	name: "Atlas",
	workspaceId: "ws-other",
} as const;

const HOME_RECORD = {
	id: "record-home",
	projectId: ATLAS.id,
	title: "Pricing decision",
	workspaceId: "ws-home",
} as const;

const FOREIGN_RECORD = {
	id: "record-foreign",
	projectId: OTHER_WORKSPACE_PROJECT.id,
	title: "Pricing decision",
	workspaceId: "ws-other",
} as const;

function memoryMutation(): PaletteMutationPort & {
	undoCalls: string[];
	writes: PaletteMutationApplyInput[];
} {
	const writes: PaletteMutationApplyInput[] = [];
	const undoCalls: string[] = [];
	return {
		apply(input) {
			writes.push(input);
			return {
				historyEntryId: `history-${writes.length}`,
				status: "committed",
			};
		},
		undo(input) {
			undoCalls.push(input.historyEntryId);
			return { historyEntryId: input.historyEntryId, status: "committed" };
		},
		undoCalls,
		writes,
	};
}

function founderInput(
	overrides: Partial<CommandPaletteInput> = {}
): CommandPaletteInput {
	const mutation = overrides.mutation ?? memoryMutation();
	return {
		catalog: {
			projects: [ATLAS, NOVA, OTHER_WORKSPACE_PROJECT],
			records: [HOME_RECORD, FOREIGN_RECORD],
		},
		context: {
			currentProjectId: ATLAS.id,
			recordRevision: 3,
			selectionIds: ["record-home"],
		},
		mutation,
		session: {
			authorizedProjectIds: [ATLAS.id, NOVA.id],
			authorizedRecordIds: [HOME_RECORD.id],
			workspaceId: "ws-home",
			workspaceLabel: "Workspace",
		},
		surface: "founder",
		...overrides,
	};
}

function percentile(values: number[], percent: number): number {
	const sorted = [...values].sort((left, right) => left - right);
	const index = Math.ceil((percent / 100) * sorted.length) - 1;
	return sorted[Math.max(0, index)] ?? Number.POSITIVE_INFINITY;
}

function openWithKeyboard(input: CommandPaletteInput = founderInput()) {
	const palette = createCommandPalette(input);
	return { palette, result: palette.handleKeyDown(OPEN_KEY) };
}

test("the palette title is Command Palette and is never Search", () => {
	const snapshot = createCommandPalette(founderInput()).open();
	expect(snapshot.title).toBe("Command Palette");
	expect(snapshot.title).not.toBe("Search");
});

test("Ctrl+K opens the palette on founder chrome", () => {
	const { result } = openWithKeyboard();
	expect(result.consume).toBe(true);
	expect(result.snapshot.visible).toBe(true);
	expect(result.snapshot.title).toBe("Command Palette");
});

test("opening the palette meets the p95 150 ms and p99 300 ms visibility budget", () => {
	const samples: number[] = [];
	for (let index = 0; index < 100; index += 1) {
		const snapshot = createCommandPalette(founderInput()).open();
		expect(snapshot.visible).toBe(true);
		samples.push(snapshot.visibilityMs);
	}
	expect(percentile(samples, 95)).toBeLessThanOrEqual(
		PALETTE_VISIBILITY_BUDGET_MS.p95
	);
	expect(percentile(samples, 99)).toBeLessThanOrEqual(
		PALETTE_VISIBILITY_BUDGET_MS.p99
	);
});

test("palette search lists only records in the authorized Workspace", () => {
	const palette = createCommandPalette(founderInput());
	palette.open();
	const snapshot = palette.setQuery("Pricing");
	expect(snapshot.commands.map((command) => command.id)).toEqual([
		"open:record-home",
	]);
	expect(
		snapshot.commands.some((command) => command.id === "open:record-foreign")
	).toBe(false);
});

test("Switch Project lists only authorized Projects", () => {
	const snapshot = createCommandPalette(founderInput()).open();
	const switchIds = snapshot.commands
		.filter((command) => command.kind === "switch-project")
		.map((command) => command.id);
	expect(switchIds).toEqual(["switch-project:project-nova"]);
	expect(switchIds).not.toContain("switch-project:project-foreign");
});

test("Create targets only an authorized Project", () => {
	const mutation = memoryMutation();
	const palette = createCommandPalette(founderInput({ mutation }));
	palette.open();
	const create = palette
		.snapshot()
		.commands.find((command) => command.id === "create:work");
	expect(create?.preview.scope).toBe("Atlas");
	expect(create?.runnable).toBe(true);
	const result = palette.run("create:work");
	expect(result.status).toBe("committed");
	expect(result.wrote).toBe(true);
	expect(mutation.writes).toHaveLength(1);
	expect(mutation.writes[0]?.targetId).toBe(ATLAS.id);
	expect(mutation.writes[0]?.baseRevision).toBe(3);
	expect(mutation.writes[0]?.idempotencyKey).toEqual(expect.any(String));
});

test("every palette command has a visible menu counterpart", () => {
	const palette = createCommandPalette(founderInput());
	const snapshot = palette.open();
	const menuIds = new Set(
		snapshot.visibleMenuActions.map((action) => action.id)
	);
	expect(menuIds.has("open-palette")).toBe(true);
	expect(
		snapshot.visibleMenuActions.find((action) => action.id === "open-palette")
			?.shortcutHint
	).toBe(COMMAND_PALETTE_SHORTCUT_HINT);
	for (const command of snapshot.commands) {
		expect(menuIds.has(command.menuCounterpartId)).toBe(true);
	}
	palette.setQuery("Pricing");
	for (const command of palette.snapshot().commands) {
		expect(menuIds.has(command.menuCounterpartId)).toBe(true);
	}
});

test("shortcuts are the documented map and cannot be remapped", () => {
	expect(
		isPaletteOpenShortcut({ ctrlKey: true, key: "k", metaKey: false })
	).toBe(true);
	expect(
		isPaletteOpenShortcut({ ctrlKey: false, key: "k", metaKey: true })
	).toBe(true);
	expect(
		isPaletteOpenShortcut({ ctrlKey: true, key: "p", metaKey: false })
	).toBe(false);
	const closed = createCommandPalette(founderInput()).handleKeyDown({
		ctrlKey: true,
		key: "p",
		metaKey: false,
	});
	expect(closed.snapshot.visible).toBe(false);
});

test("scope, target, and selection count are visible before a command runs", () => {
	const snapshot = createCommandPalette(founderInput()).open();
	const create = snapshot.commands.find(
		(command) => command.id === "create:work"
	);
	expect(create?.preview).toEqual({
		scope: "Atlas",
		selectionCount: 1,
		target: "Work",
	});
	const switchProject = snapshot.commands.find(
		(command) => command.id === "switch-project:project-nova"
	);
	expect(switchProject?.preview).toEqual({
		scope: "Nova",
		selectionCount: 0,
		target: "Nova",
	});
});

test("Undo is not offered until a reversible Create commits", () => {
	const mutation = memoryMutation();
	const palette = createCommandPalette(founderInput({ mutation }));
	expect(palette.snapshot().canUndo).toBe(false);
	expect(palette.snapshot().undoLabel).toBe(null);
	const undone = palette.undoLast();
	expect(undone.status).toBe("failed");
	expect(undone.wrote).toBe(false);
	expect(undone.reason).toBe("Can't run this here");
	expect(mutation.undoCalls).toHaveLength(0);
});

test("a reversible Create uses the Mutation Contract envelope and Undo", () => {
	const mutation = memoryMutation();
	const palette = createCommandPalette(founderInput({ mutation }));
	const created = palette.run("create:work");
	expect(created.status).toBe("committed");
	expect(created.undoLabel).toBe("Undo");
	expect(created.wrote).toBe(true);
	expect(created.snapshot.canUndo).toBe(true);
	expect(created.snapshot.undoLabel).toBe("Undo");
	expect(mutation.writes[0]).toEqual(
		expect.objectContaining({
			baseRevision: 3,
			payload: {
				kind: "create",
				projectId: ATLAS.id,
				recordType: "Work",
			},
			targetId: ATLAS.id,
		})
	);
	const undone = palette.undoLast();
	expect(undone.status).toBe("committed");
	expect(undone.snapshot.canUndo).toBe(false);
	expect(mutation.undoCalls).toEqual(["history-1"]);
});

test("an out-of-scope command fails visibly and does not write", () => {
	const mutation = memoryMutation();
	const palette = createCommandPalette(founderInput({ mutation }));
	const result = palette.run("switch-project:project-foreign");
	expect(result.status).toBe("failed");
	expect(result.reason).toBe("Can't run this here");
	expect(result.wrote).toBe(false);
	expect(result.snapshot.failure).toBe("Can't run this here");
	expect(result.snapshot.canUndo).toBe(false);
	expect(mutation.writes).toHaveLength(0);
});

test("a visitor or public surface does not mount the founder palette", () => {
	expect(shouldMountFounderPalette("founder")).toBe(true);
	expect(shouldMountFounderPalette("visitor")).toBe(false);
	expect(shouldMountFounderPalette("public")).toBe(false);
	expect(shouldMountFounderPalette("share-session")).toBe(false);
	expect(visitorDocumentMountsFounderPalette()).toBe(false);
	const visitor = createCommandPalette(
		founderInput({ surface: "visitor" })
	).handleKeyDown(OPEN_KEY);
	expect(visitor.snapshot.visible).toBe(false);
	expect(visitor.snapshot.failure).toBe("Can't run this here");
});

test("keyboard-only use can open, filter, run, and dismiss", () => {
	const palette = createCommandPalette(founderInput());
	expect(palette.handleKeyDown(OPEN_KEY).snapshot.visible).toBe(true);
	const filtered = palette.setQuery("Nova");
	expect(filtered.commands.map((command) => command.id)).toEqual([
		"switch-project:project-nova",
	]);
	const ran = palette.run("switch-project:project-nova");
	expect(ran.status).toBe("switched");
	expect(ran.snapshot.visible).toBe(false);
	palette.open();
	const dismissed = palette.handleKeyDown({
		ctrlKey: false,
		key: "Escape",
		metaKey: false,
	});
	expect(dismissed.consume).toBe(true);
	expect(dismissed.snapshot.visible).toBe(false);
});

test("Create, Switch Project, and search stay available without a settings gate", () => {
	const snapshot = createCommandPalette(founderInput()).open();
	expect(
		snapshot.commands.some((command) => command.id === "create:work")
	).toBe(true);
	expect(
		snapshot.commands.some((command) => command.kind === "switch-project")
	).toBe(true);
	const searched = createCommandPalette(founderInput()).setQuery("Pricing");
	expect(searched.commands.some((command) => command.kind === "open")).toBe(
		true
	);
});

test("opening Create from the menu shows preview and does not write", () => {
	const mutation = memoryMutation();
	const palette = createCommandPalette(founderInput({ mutation }));
	palette.open();
	const snapshot = palette.setQuery(COMMAND_PALETTE_COPY.create);
	const create = snapshot.commands.find(
		(command) => command.id === "create:work"
	);
	expect(snapshot.visible).toBe(true);
	expect(create?.preview).toEqual({
		scope: "Atlas",
		selectionCount: 1,
		target: "Work",
	});
	expect(mutation.writes).toHaveLength(0);
});

test("the palette is not an automation, marketplace, or remappable keymap host", () => {
	const palette = createCommandPalette(founderInput());
	const snapshot = palette.setQuery("automation plugin marketplace");
	expect(snapshot.commands).toEqual([]);
	expect(snapshot.emptyReason).toBe("No matching command");
	expect(palette.snapshot()).not.toHaveProperty("remapShortcut");
});

test("an empty founder palette still opens with the product command names", () => {
	const snapshot = createCommandPalette(emptyFounderPaletteInput()).open();
	expect(snapshot.visible).toBe(true);
	expect(snapshot.commands.map((command) => command.label)).toEqual([
		"Create",
		"Switch Project",
	]);
	expect(snapshot.commands.every((command) => command.runnable === false)).toBe(
		true
	);
});

test("running Create without an authorized Project does not write", () => {
	const mutation = memoryMutation();
	const result = createCommandPalette(
		founderInput({
			catalog: { projects: [], records: [] },
			context: {
				currentProjectId: null,
				selectionIds: [],
			},
			mutation,
			session: {
				authorizedProjectIds: [],
				authorizedRecordIds: [],
				workspaceId: "ws-home",
				workspaceLabel: "Workspace",
			},
		})
	).run("create:work");
	expect(result.status).toBe("failed");
	expect(result.reason).toBe("Can't run this here");
	expect(result.wrote).toBe(false);
	expect(mutation.writes).toHaveLength(0);
});

test("the visibility budget still holds on a large authorized catalog", () => {
	const projects = Array.from({ length: 25 }, (_, index) => ({
		id: `project-${index}`,
		name: `Project ${index}`,
		workspaceId: "ws-home",
	}));
	const records = Array.from({ length: 400 }, (_, index) => ({
		id: `record-${index}`,
		projectId: `project-${index % 25}`,
		title: `Record ${index}`,
		workspaceId: "ws-home",
	}));
	const input = founderInput({
		catalog: { projects, records },
		context: {
			currentProjectId: "project-0",
			selectionIds: [],
		},
		session: {
			authorizedProjectIds: projects.map((project) => project.id),
			authorizedRecordIds: records.map((record) => record.id),
			workspaceId: "ws-home",
			workspaceLabel: "Workspace",
		},
	});
	const samples: number[] = [];
	for (let index = 0; index < 100; index += 1) {
		samples.push(createCommandPalette(input).open().visibilityMs);
	}
	expect(percentile(samples, 95)).toBeLessThanOrEqual(150);
	expect(percentile(samples, 99)).toBeLessThanOrEqual(300);
});

test("the public snapshot never titles the palette Search", () => {
	const snapshot: PaletteSnapshot = createCommandPalette(founderInput()).open();
	expect(JSON.stringify(snapshot)).not.toMatch(SEARCH_TITLE);
});
