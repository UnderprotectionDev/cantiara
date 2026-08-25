import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function listenHost() {
	if (process.env.CANTIARA_LISTEN_HOST) {
		return process.env.CANTIARA_LISTEN_HOST;
	}
	if (process.env.CURSOR_AGENT === "1") {
		return "0.0.0.0";
	}
	return "localhost";
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		tanstackRouter({
			autoCodeSplitting: true,
			target: "react",
		}),
		react(),
	],
	resolve: {
		tsconfigPaths: true,
	},
	server: {
		host: listenHost(),
		port: 3001,
	},
});
