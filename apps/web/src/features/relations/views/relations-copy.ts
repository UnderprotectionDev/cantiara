export const USAGE_KINDS = [
	"inline-record-reference",
	"stable-section-reference",
	"live-content-block",
	"pinned-file-or-wireframe-bind",
	"flow-node-screen-reference",
] as const;

export type UsageKind = (typeof USAGE_KINDS)[number];

export const RELATIONS_COPY = {
	inlineReference: "Inline reference",
	liveBlock: "Live block",
	pinnedBind: "Pinned bind",
	related: "Related",
	screenReference: "Screen reference",
	sectionReference: "Section reference",
	unlink: "Unlink",
	usedIn: "Used in",
} as const;

export const USAGE_KIND_LABEL: Record<UsageKind, string> = {
	"flow-node-screen-reference": RELATIONS_COPY.screenReference,
	"inline-record-reference": RELATIONS_COPY.inlineReference,
	"live-content-block": RELATIONS_COPY.liveBlock,
	"pinned-file-or-wireframe-bind": RELATIONS_COPY.pinnedBind,
	"stable-section-reference": RELATIONS_COPY.sectionReference,
};
