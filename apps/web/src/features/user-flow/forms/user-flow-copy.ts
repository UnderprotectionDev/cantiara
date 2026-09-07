export const USER_FLOW_COPY = {
	action: "Action",
	align: "Align",
	archived: "Archived",
	bindScreen: "Bind Screen",
	collapseGroup: "Collapse",
	condition: "Condition",
	confirm: "Confirm",
	convertAndBind: "Convert and Bind",
	createFromTemplate: "Create from template",
	createScreen: "Create Screen",
	createUserFlow: "Create User Flow",
	decision: "Decision",
	description: "Description",
	expandGroup: "Expand",
	fitView: "Fit View",
	group: "Group",
	inspect: "Inspect",
	moveDown: "Move down",
	moveUp: "Move up",
	noUserFlows: "No User Flows yet.",
	openQuestion: "Open Question",
	openSourceRecord: "Open Source Record",
	origin: "Origin",
	originLocation: "Origin Location",
	outline: "Outline",
	placeLiveCard: "Place live card",
	placeNode: "Place node",
	promoteToScreen: "Promote to Screen",
	rebind: "Rebind",
	risk: "Risk",
	saveAsTemplate: "Save as template",
	screen: "Screen",
	section: "Section",
	stateOutcome: "State/Outcome",
	title: "Title",
	transition: "Transition",
	unbind: "Unbind",
	undo: "Undo",
	userFlow: "User Flow",
	work: "Work",
} as const;

export function flowCanvasColorMode(
	theme: string | undefined
): "dark" | "light" {
	return theme === "light" ? "light" : "dark";
}

export const FLOW_NODE_KINDS = [
	USER_FLOW_COPY.screen,
	USER_FLOW_COPY.action,
	USER_FLOW_COPY.decision,
	USER_FLOW_COPY.stateOutcome,
	USER_FLOW_COPY.section,
] as const;

export const CONVERT_RECORD_KINDS = [
	USER_FLOW_COPY.work,
	USER_FLOW_COPY.decision,
	USER_FLOW_COPY.risk,
	USER_FLOW_COPY.openQuestion,
] as const;
