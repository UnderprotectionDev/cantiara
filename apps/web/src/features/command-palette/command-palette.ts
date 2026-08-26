import {
	type MUTATION_COPY,
	presentReversibleWriteUi,
	withHumanMutationEnvelope,
} from "../../lib/mutation";

import {
	COMMAND_PALETTE_COPY,
	COMMAND_PALETTE_SHORTCUT_HINT,
	COMMAND_PALETTE_SHORTCUTS,
} from "./command-palette-copy";

export type PaletteSurface = "founder" | "public" | "share-session" | "visitor";

export interface PaletteKeyEvent {
	ctrlKey: boolean;
	key: string;
	metaKey: boolean;
	repeat?: boolean;
}

export interface PaletteProject {
	id: string;
	name: string;
	workspaceId: string;
}

export interface PaletteRecord {
	id: string;
	projectId: string;
	title: string;
	workspaceId: string;
}

export interface PaletteSession {
	authorizedProjectIds: readonly string[];
	authorizedRecordIds: readonly string[];
	workspaceId: string;
	workspaceLabel: string;
}

export interface PaletteContext {
	currentProjectId: string | null;
	recordRevision?: number;
	selectionIds: readonly string[];
}

export interface PaletteMutationApplyInput {
	baseRevision: number;
	idempotencyKey: string;
	payload: unknown;
	targetId: string;
}

export type PaletteMutationOutcome =
	| { historyEntryId: string; status: "committed" }
	| { status: "rejected" };

export interface PaletteMutationPort {
	apply: (input: PaletteMutationApplyInput) => PaletteMutationOutcome;
	undo: (input: {
		historyEntryId: string;
		idempotencyKey: string;
		targetId: string;
	}) => PaletteMutationOutcome;
}

export interface CommandPaletteInput {
	catalog: {
		projects: readonly PaletteProject[];
		records: readonly PaletteRecord[];
	};
	context: PaletteContext;
	mutation: PaletteMutationPort;
	session: PaletteSession;
	surface: PaletteSurface;
}

export type PaletteCommandKind = "create" | "open" | "switch-project";

export interface PaletteCommandPreview {
	scope: string;
	selectionCount: number;
	target: string;
}

export interface PaletteCommand {
	id: string;
	kind: PaletteCommandKind;
	label: string;
	menuCounterpartId: string;
	preview: PaletteCommandPreview;
	reversible: boolean;
	runnable: boolean;
	shortcutHint: string | null;
}

export interface VisibleMenuAction {
	id: string;
	label: string;
	shortcutHint: string | null;
}

export interface PaletteSnapshot {
	canUndo: boolean;
	commands: PaletteCommand[];
	emptyReason: typeof COMMAND_PALETTE_COPY.noMatchingCommand | null;
	failure: typeof COMMAND_PALETTE_COPY.cantRunThisHere | null;
	query: string;
	title: typeof COMMAND_PALETTE_COPY.title;
	undoLabel: typeof MUTATION_COPY.undo | null;
	visibilityMs: number;
	visible: boolean;
	visibleMenuActions: readonly VisibleMenuAction[];
}

export interface PaletteRunResult {
	reason?: typeof COMMAND_PALETTE_COPY.cantRunThisHere;
	snapshot: PaletteSnapshot;
	status: "committed" | "failed" | "opened" | "switched";
	undoLabel?: typeof MUTATION_COPY.undo;
	wrote: boolean;
}

export interface PaletteKeyResult {
	consume: boolean;
	snapshot: PaletteSnapshot;
}

export interface CommandPalette {
	handleKeyDown: (event: PaletteKeyEvent) => PaletteKeyResult;
	open: () => PaletteSnapshot;
	run: (commandId: string) => PaletteRunResult;
	setQuery: (query: string) => PaletteSnapshot;
	snapshot: () => PaletteSnapshot;
	undoLast: () => PaletteRunResult;
	visibleMenuActions: () => readonly VisibleMenuAction[];
}

const MENU_ACTIONS: readonly VisibleMenuAction[] = [
	{
		id: "open-palette",
		label: COMMAND_PALETTE_COPY.title,
		shortcutHint: COMMAND_PALETTE_SHORTCUT_HINT,
	},
	{
		id: "create:work",
		label: COMMAND_PALETTE_COPY.create,
		shortcutHint: null,
	},
	{
		id: "switch-project",
		label: COMMAND_PALETTE_COPY.switchProject,
		shortcutHint: null,
	},
	{
		id: "open-record",
		label: COMMAND_PALETTE_COPY.open,
		shortcutHint: null,
	},
];

export const noopPaletteMutation: PaletteMutationPort = {
	apply: () => ({ status: "rejected" }),
	undo: () => ({ status: "rejected" }),
};

export type VisitorPaletteSurface = Exclude<PaletteSurface, "founder">;

export interface VisitorDocumentChrome {
	host: "visitor-document";
	listensForOpenShortcut: false;
	mountsFounderPalette: false;
	surface: VisitorPaletteSurface;
	workspaceCommandIds: readonly [];
}

export function shouldMountFounderPalette(surface: PaletteSurface): boolean {
	return surface === "founder";
}

export function shouldRenderFounderPalette(
	surface: PaletteSurface,
	signedIn: boolean
): boolean {
	return signedIn && shouldMountFounderPalette(surface);
}

export function visitorDocumentMountsFounderPalette(): boolean {
	return shouldMountFounderPalette("visitor");
}

export function visitorDocumentChrome(
	surface: VisitorPaletteSurface
): VisitorDocumentChrome {
	return {
		host: "visitor-document",
		listensForOpenShortcut: false,
		mountsFounderPalette: false,
		surface,
		workspaceCommandIds: [],
	};
}

export function isPaletteOpenShortcut(event: PaletteKeyEvent): boolean {
	if (event.repeat) {
		return false;
	}
	if (event.key.toLowerCase() !== COMMAND_PALETTE_SHORTCUTS.open.key) {
		return false;
	}
	return event.metaKey || event.ctrlKey;
}

export function isPaletteDismissShortcut(event: PaletteKeyEvent): boolean {
	return event.key === "Escape";
}

export function isPaletteRunShortcut(event: PaletteKeyEvent): boolean {
	return event.key === "Enter";
}

export function isPaletteFilterKey(event: PaletteKeyEvent): boolean {
	if (event.ctrlKey || event.metaKey || event.repeat) {
		return false;
	}
	if (event.key === "Backspace") {
		return true;
	}
	return event.key.length === 1;
}

export function emptyFounderPaletteInput(): CommandPaletteInput {
	return {
		catalog: { projects: [], records: [] },
		context: {
			currentProjectId: null,
			selectionIds: [],
		},
		mutation: noopPaletteMutation,
		session: {
			authorizedProjectIds: [],
			authorizedRecordIds: [],
			workspaceId: "workspace",
			workspaceLabel: "Workspace",
		},
		surface: "founder",
	};
}

export function createCommandPalette(
	input: CommandPaletteInput
): CommandPalette {
	let failure: PaletteSnapshot["failure"] = null;
	let isOpen = false;
	let lastUndo: { historyEntryId: string; targetId: string } | null = null;
	let query = "";
	let visibilityMs = 0;

	function authorizedProjects(): PaletteProject[] {
		return input.catalog.projects.filter(
			(project) =>
				project.workspaceId === input.session.workspaceId &&
				input.session.authorizedProjectIds.includes(project.id)
		);
	}

	function projectNamed(projectId: string): string {
		return (
			authorizedProjects().find((project) => project.id === projectId)?.name ??
			input.session.workspaceLabel
		);
	}

	function createTarget(): PaletteProject | null {
		const projects = authorizedProjects();
		if (input.context.currentProjectId) {
			return (
				projects.find(
					(project) => project.id === input.context.currentProjectId
				) ?? null
			);
		}
		if (projects.length === 1) {
			return projects[0] ?? null;
		}
		return null;
	}

	function authorizedRecords(): PaletteRecord[] {
		return input.catalog.records.filter(
			(record) =>
				record.workspaceId === input.session.workspaceId &&
				input.session.authorizedRecordIds.includes(record.id) &&
				input.session.authorizedProjectIds.includes(record.projectId)
		);
	}

	function matchesQuery(text: string): boolean {
		const needle = query.trim().toLowerCase();
		if (needle.length === 0) {
			return true;
		}
		return text.toLowerCase().includes(needle);
	}

	function createCommand(): PaletteCommand {
		const target = createTarget();
		return {
			id: "create:work",
			kind: "create",
			label: COMMAND_PALETTE_COPY.create,
			menuCounterpartId: "create:work",
			preview: {
				scope: target === null ? input.session.workspaceLabel : target.name,
				selectionCount: input.context.selectionIds.length,
				target: "Work",
			},
			reversible: true,
			runnable: target !== null,
			shortcutHint: null,
		};
	}

	function switchCommands(): PaletteCommand[] {
		const projects = authorizedProjects().filter(
			(project) => project.id !== input.context.currentProjectId
		);
		if (projects.length === 0) {
			return [
				{
					id: "switch-project",
					kind: "switch-project",
					label: COMMAND_PALETTE_COPY.switchProject,
					menuCounterpartId: "switch-project",
					preview: {
						scope: input.session.workspaceLabel,
						selectionCount: 0,
						target: COMMAND_PALETTE_COPY.switchProject,
					},
					reversible: false,
					runnable: false,
					shortcutHint: null,
				},
			];
		}
		return projects.map((project) => ({
			id: `switch-project:${project.id}`,
			kind: "switch-project" as const,
			label: COMMAND_PALETTE_COPY.switchProject,
			menuCounterpartId: "switch-project",
			preview: {
				scope: project.name,
				selectionCount: 0,
				target: project.name,
			},
			reversible: false,
			runnable: true,
			shortcutHint: null,
		}));
	}

	function openRecordCommand(record: PaletteRecord): PaletteCommand {
		return {
			id: `open:${record.id}`,
			kind: "open",
			label: record.title,
			menuCounterpartId: "open-record",
			preview: {
				scope: projectNamed(record.projectId),
				selectionCount: 1,
				target: record.title,
			},
			reversible: false,
			runnable: true,
			shortcutHint: null,
		};
	}

	function openCommands(): PaletteCommand[] {
		if (query.trim().length === 0) {
			return [];
		}
		return authorizedRecords()
			.filter((record) => matchesQuery(record.title))
			.map(openRecordCommand);
	}

	function commandById(commandId: string): PaletteCommand | undefined {
		if (commandId === "create:work") {
			return createCommand();
		}
		const switchCommand = switchCommands().find(
			(command) => command.id === commandId
		);
		if (switchCommand) {
			return switchCommand;
		}
		if (!commandId.startsWith("open:")) {
			return;
		}
		const recordId = commandId.slice("open:".length);
		const record = authorizedRecords().find((entry) => entry.id === recordId);
		if (!record) {
			return;
		}
		return openRecordCommand(record);
	}

	function matchesCommand(command: PaletteCommand): boolean {
		return (
			matchesQuery(command.label) ||
			matchesQuery(command.preview.target) ||
			matchesQuery(command.preview.scope)
		);
	}

	function visibleCommands(): PaletteCommand[] {
		if (input.surface !== "founder") {
			return [];
		}
		const actions = [createCommand(), ...switchCommands()].filter((command) =>
			matchesCommand(command)
		);
		return [...actions, ...openCommands()];
	}

	function snapshot(): PaletteSnapshot {
		const commands = visibleCommands();
		const undo = presentReversibleWriteUi(lastUndo !== null);
		return {
			canUndo: undo.undoAvailable,
			commands,
			emptyReason:
				commands.length === 0 ? COMMAND_PALETTE_COPY.noMatchingCommand : null,
			failure,
			query,
			title: COMMAND_PALETTE_COPY.title,
			undoLabel: undo.label,
			visibilityMs,
			visible: isOpen,
			visibleMenuActions: MENU_ACTIONS,
		};
	}

	function failedRun(): PaletteRunResult {
		failure = COMMAND_PALETTE_COPY.cantRunThisHere;
		return {
			reason: COMMAND_PALETTE_COPY.cantRunThisHere,
			snapshot: snapshot(),
			status: "failed",
			wrote: false,
		};
	}

	function open(): PaletteSnapshot {
		const started = performance.now();
		if (input.surface !== "founder") {
			isOpen = false;
			failure = null;
			visibilityMs = 0;
			return snapshot();
		}
		isOpen = true;
		query = "";
		failure = null;
		visibilityMs = performance.now() - started;
		return snapshot();
	}

	function close(): PaletteSnapshot {
		isOpen = false;
		query = "";
		return snapshot();
	}

	function setQuery(nextQuery: string): PaletteSnapshot {
		query = nextQuery;
		failure = null;
		return snapshot();
	}

	function runCreate(command: PaletteCommand): PaletteRunResult {
		const target = createTarget();
		if (!(command.runnable && target)) {
			return failedRun();
		}
		const envelope = withHumanMutationEnvelope({
			baseRevision: input.context.recordRevision ?? 0,
			payload: {
				kind: "create",
				projectId: target.id,
				recordType: "Work",
			},
		});
		const outcome = input.mutation.apply({
			targetId: target.id,
			...envelope,
		});
		if (outcome.status !== "committed") {
			return failedRun();
		}
		lastUndo = { historyEntryId: outcome.historyEntryId, targetId: target.id };
		failure = null;
		isOpen = false;
		query = "";
		const undo = presentReversibleWriteUi(true);
		return {
			snapshot: snapshot(),
			status: "committed",
			undoLabel: undo.label ?? undefined,
			wrote: true,
		};
	}

	function run(commandId: string): PaletteRunResult {
		if (input.surface !== "founder") {
			return failedRun();
		}
		const command = commandById(commandId);
		if (!command?.runnable) {
			return failedRun();
		}
		if (command.kind === "create") {
			return runCreate(command);
		}
		failure = null;
		isOpen = false;
		query = "";
		if (command.kind === "switch-project") {
			return { snapshot: snapshot(), status: "switched", wrote: false };
		}
		return { snapshot: snapshot(), status: "opened", wrote: false };
	}

	function undoLast(): PaletteRunResult {
		if (!lastUndo) {
			return failedRun();
		}
		const envelope = withHumanMutationEnvelope({
			baseRevision: input.context.recordRevision ?? 0,
			payload: { historyEntryId: lastUndo.historyEntryId, undo: true },
		});
		const outcome = input.mutation.undo({
			historyEntryId: lastUndo.historyEntryId,
			idempotencyKey: envelope.idempotencyKey,
			targetId: lastUndo.targetId,
		});
		if (outcome.status !== "committed") {
			return failedRun();
		}
		lastUndo = null;
		failure = null;
		return { snapshot: snapshot(), status: "committed", wrote: true };
	}

	function applyFilterKey(event: PaletteKeyEvent): PaletteSnapshot {
		if (event.key === "Backspace") {
			query = query.slice(0, -1);
		} else {
			query += event.key;
		}
		failure = null;
		return snapshot();
	}

	function runActiveCommand(): PaletteKeyResult {
		const command = visibleCommands().find((entry) => entry.runnable);
		const result = run(command?.id ?? "");
		return { consume: true, snapshot: result.snapshot };
	}

	function handleKeyDown(event: PaletteKeyEvent): PaletteKeyResult {
		if (input.surface !== "founder") {
			return { consume: false, snapshot: snapshot() };
		}
		if (isPaletteOpenShortcut(event)) {
			return { consume: true, snapshot: open() };
		}
		if (!isOpen) {
			return { consume: false, snapshot: snapshot() };
		}
		if (isPaletteDismissShortcut(event)) {
			failure = null;
			return { consume: true, snapshot: close() };
		}
		if (isPaletteRunShortcut(event)) {
			return runActiveCommand();
		}
		if (isPaletteFilterKey(event)) {
			return { consume: true, snapshot: applyFilterKey(event) };
		}
		return { consume: false, snapshot: snapshot() };
	}

	return {
		handleKeyDown,
		open,
		run,
		setQuery,
		snapshot,
		undoLast,
		visibleMenuActions: () => MENU_ACTIONS,
	};
}
