const LINE_SPLIT = /\r?\n/;
const TITLE_HEADER = /^title$/i;
const KEY_HEADER = /^key$/i;

export function parseTablePaste(text: string): {
	headers: string[];
	rows: string[][];
} {
	const lines = text
		.split(LINE_SPLIT)
		.map((line) => line.trimEnd())
		.filter((line) => line.length > 0);
	if (lines.length === 0) {
		return { headers: [], rows: [] };
	}
	const delimiter = lines.some((line) => line.includes("\t")) ? "\t" : ",";
	const parsed = lines.map((line) =>
		line.split(delimiter).map((cell) => cell.trim())
	);
	const [headers, ...rows] = parsed;
	return { headers: headers ?? [], rows };
}

export function defaultPasteMapping(headers: readonly string[]): {
	key: number | null;
	title: number;
} {
	const title = headers.findIndex((header) => TITLE_HEADER.test(header));
	const key = headers.findIndex((header) => KEY_HEADER.test(header));
	let mappedKey: number | null = null;
	if (key >= 0) {
		mappedKey = key;
	} else if (headers.length > 1) {
		mappedKey = 0;
	}
	return {
		key: mappedKey,
		title: title >= 0 ? title : Math.max(headers.length - 1, 0),
	};
}
