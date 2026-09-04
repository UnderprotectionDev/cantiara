export function youtubePlayerFrameSrc(input: {
	loaded: boolean;
	player: {
		autoplay: boolean;
		available: boolean;
		embedUrl: string | null;
		provider: string;
	} | null;
}): string | null {
	if (!input.loaded) {
		return null;
	}
	if (!input.player?.available) {
		return null;
	}
	if (input.player.provider !== "youtube") {
		return null;
	}
	if (input.player.autoplay) {
		return null;
	}
	const src = input.player.embedUrl;
	if (!src || src.includes("autoplay=1")) {
		return null;
	}
	return src;
}
