const EYEDROP_HEX = /^#[0-9A-Fa-f]{6}$/;

export async function eyedropScreenColor(): Promise<string | null> {
	const EyeDropperCtor = (
		globalThis as {
			EyeDropper?: new () => {
				open: () => Promise<{ sRGBHex: string }>;
			};
		}
	).EyeDropper;
	if (!EyeDropperCtor) {
		return null;
	}
	const result = await new EyeDropperCtor().open();
	const hex = result.sRGBHex;
	if (!EYEDROP_HEX.test(hex)) {
		return null;
	}
	return hex.toUpperCase();
}
