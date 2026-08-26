import { defineContentScript } from "wxt/utils/define-content-script";

export default defineContentScript({
	main() {
		// Web Yakalama does not scan pages in the background.
	},
	matches: ["https://cantiara.invalid/*"],
});
