import { Parser } from "htmlparser2";

const SKIP_TAGS = new Set(["script", "style", "noscript"]);

export function extractCapturedSnapshot(html: string): {
	capturedContent: string;
	title: string;
} {
	let title = "";
	let ogTitle = "";
	let inTitle = false;
	let skipDepth = 0;
	const chunks: string[] = [];
	const parser = new Parser(
		{
			onclosetag(name) {
				if (name === "title") {
					inTitle = false;
				}
				if (SKIP_TAGS.has(name) && skipDepth > 0) {
					skipDepth -= 1;
				}
			},
			onopentag(name, attributes) {
				if (name === "title") {
					inTitle = true;
				}
				if (SKIP_TAGS.has(name)) {
					skipDepth += 1;
				}
				if (name !== "meta") {
					return;
				}
				const property = (
					attributes.property ??
					attributes.name ??
					""
				).toLowerCase();
				const content = attributes.content?.trim() ?? "";
				if (
					content !== "" &&
					(property === "og:title" || property === "twitter:title")
				) {
					ogTitle = content;
				}
			},
			ontext(text) {
				if (inTitle) {
					title += text;
				}
				if (skipDepth > 0) {
					return;
				}
				const trimmed = text.replace(/\s+/g, " ").trim();
				if (trimmed !== "") {
					chunks.push(trimmed);
				}
			},
		},
		{ decodeEntities: true }
	);
	parser.write(html);
	parser.end();
	return {
		capturedContent: chunks.join("\n"),
		title: (ogTitle || title).replace(/\s+/g, " ").trim(),
	};
}
