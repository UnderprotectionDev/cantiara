import { expect, test } from "vitest";

import { youtubePlayerFrameSrc } from "./smart-link-preview-presentation";

test("YouTube player iframe is absent until click-to-load and never autoplays", () => {
	const player = {
		autoplay: false,
		available: true,
		embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0",
		provider: "youtube",
	};
	expect(youtubePlayerFrameSrc({ loaded: false, player })).toBeNull();
	expect(youtubePlayerFrameSrc({ loaded: true, player })).toBe(player.embedUrl);
	expect(
		youtubePlayerFrameSrc({
			loaded: true,
			player: { ...player, autoplay: true },
		})
	).toBeNull();
	expect(
		youtubePlayerFrameSrc({
			loaded: true,
			player: {
				...player,
				embedUrl:
					"https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1",
			},
		})
	).toBeNull();
	expect(
		youtubePlayerFrameSrc({
			loaded: true,
			player: { ...player, available: false, embedUrl: null },
		})
	).toBeNull();
	expect(youtubePlayerFrameSrc({ loaded: true, player: null })).toBeNull();
	expect(
		youtubePlayerFrameSrc({
			loaded: true,
			player: { ...player, provider: "vimeo" },
		})
	).toBeNull();
});
