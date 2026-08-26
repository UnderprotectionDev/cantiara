import { defineConfig } from "wxt";

export default defineConfig({
	manifest: {
		description: "Send a Web Capture to Capture Inbox.",
		name: "Cantiara Web Capture",
		permissions: ["activeTab", "scripting", "storage"],
	},
	modules: ["@wxt-dev/module-react"],
});
