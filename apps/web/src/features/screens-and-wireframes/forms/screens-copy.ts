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
	fill: string;
	stroke: string;
} {
	if (theme === "light") {
		return { fill: "#171717", stroke: "#171717" };
	}
	return { fill: "#fafafa", stroke: "#e5e5e5" };
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
