export const SCREENS_COPY = {
	active: "Active",
	align: "Align",
	archive: "Archive",
	archived: "Archived",
	broken: "Broken",
	button: "Button",
	card: "Card",
	chart: "Chart",
	collapseGroup: "Collapse",
	confirm: "Confirm",
	convertAndBind: "Convert and Bind",
	createFromTemplate: "Create Screen from template",
	createScreen: "Create Screen",
	deletePermanently: "Permanently Delete",
	detachLink: "Detach Link",
	exitPresentationMode: "Exit Presentation Mode",
	expandGroup: "Expand",
	export: "Export",
	fitView: "Fit View",
	group: "Group",
	html: "HTML",
	includeArchived: "Include archived",
	input: "Input",
	inspect: "Inspect",
	inTrash: "In Trash",
	liveSource: "Live source",
	moveDown: "Move down",
	moveToTrash: "Move to Trash",
	moveUp: "Move up",
	navigation: "Navigation",
	noScreens: "No Screens yet.",
	noScreensInTrash: "No Screens in Trash.",
	openSourceRecord: "Open Source Record",
	origin: "Origin",
	originLocation: "Origin Location",
	outline: "Outline",
	pdf: "PDF",
	png: "PNG",
	presentationMode: "Presentation Mode",
	project: "Project",
	restore: "Restore",
	saveAsTemplate: "Save as template",
	screen: "Screen",
	sourceItemIsGone: "Source item is gone",
	svg: "SVG",
	table: "Table",
	text: "Text",
	title: "Title",
	titleRequired: "Title is required.",
	unarchive: "Unarchive",
	unavailable: "Screen could not be created.",
	unresolved: "Unresolved",
	wireframe: "Wireframe",
} as const;

export const WIREFRAME_NODE_KINDS = [
	SCREENS_COPY.button,
	SCREENS_COPY.input,
	SCREENS_COPY.card,
	SCREENS_COPY.table,
	SCREENS_COPY.navigation,
	SCREENS_COPY.chart,
	SCREENS_COPY.text,
] as const;

export function wireframeCanvasInk(theme: string | undefined): {
	box: string;
	fill: string;
	stroke: string;
} {
	if (theme === "light") {
		return { box: "#fafafa", fill: "#171717", stroke: "#171717" };
	}
	return { box: "#262626", fill: "#fafafa", stroke: "#e5e5e5" };
}

export const WIREFRAME_STAGE_TYPEFACE = "sans-serif";

export type WireframeKindMark =
	| { id: string; points: number[]; type: "line" }
	| {
			height: number;
			id: string;
			type: "rect";
			width: number;
			x: number;
			y: number;
	  };

export function wireframeKindMarks(
	kind: string,
	width: number,
	height: number
): WireframeKindMark[] {
	if (kind === SCREENS_COPY.input) {
		return [
			{
				id: "input-baseline",
				points: [8, height - 8, width - 8, height - 8],
				type: "line",
			},
		];
	}
	if (kind === SCREENS_COPY.card) {
		return [{ id: "card-header", points: [0, 28, width, 28], type: "line" }];
	}
	if (kind === SCREENS_COPY.table) {
		return [
			{
				id: "table-row-1",
				points: [0, height / 3, width, height / 3],
				type: "line",
			},
			{
				id: "table-row-2",
				points: [0, (2 * height) / 3, width, (2 * height) / 3],
				type: "line",
			},
			{
				id: "table-col",
				points: [width / 3, 0, width / 3, height],
				type: "line",
			},
		];
	}
	if (kind === SCREENS_COPY.navigation) {
		return [
			{ height: 14, id: "nav-1", type: "rect", width: 40, x: 10, y: 13 },
			{ height: 14, id: "nav-2", type: "rect", width: 40, x: 58, y: 13 },
			{ height: 14, id: "nav-3", type: "rect", width: 40, x: 106, y: 13 },
		];
	}
	if (kind === SCREENS_COPY.chart) {
		return [
			{
				id: "chart-axes",
				points: [12, 12, 12, height - 12, width - 12, height - 12],
				type: "line",
			},
			{
				id: "chart-series",
				points: [
					16,
					height - 20,
					width * 0.35,
					height * 0.45,
					width * 0.65,
					height * 0.58,
					width - 16,
					20,
				],
				type: "line",
			},
		];
	}
	return [];
}

export const WIREFRAME_PANE_CLASS =
	"relative h-[min(75vh,48rem)] min-h-[32rem] w-full min-w-0 overflow-hidden rounded-md border bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-[size:16px_16px] bg-muted/20";

export const CONVERT_RECORD_KINDS = [
	"Work",
	"Decision",
	"Risk",
	"Open Question",
] as const;

export type ConvertRecordKind = (typeof CONVERT_RECORD_KINDS)[number];

export function outlineShowsConvertAndBind(input: {
	hasLiveRecord: boolean;
	selected: boolean;
	toolsHidden: boolean;
	versionNumber: number | null;
}): boolean {
	return (
		input.selected &&
		!input.toolsHidden &&
		!input.hasLiveRecord &&
		input.versionNumber !== null
	);
}

export type WireframeWriteScope = "geometry" | "outline" | "viewport";

export function wireframeWriteRefetch(scope: WireframeWriteScope): {
	get: boolean;
	getVersion: boolean;
	getViewport: boolean;
	list: boolean;
	parentScreen: boolean;
} {
	if (scope === "viewport") {
		return {
			get: false,
			getVersion: false,
			getViewport: false,
			list: false,
			parentScreen: false,
		};
	}
	if (scope === "geometry") {
		return {
			get: false,
			getVersion: true,
			getViewport: false,
			list: false,
			parentScreen: false,
		};
	}
	return {
		get: false,
		getVersion: true,
		getViewport: false,
		list: false,
		parentScreen: false,
	};
}
