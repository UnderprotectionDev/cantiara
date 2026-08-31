import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
		// Cursor port forwarding hits 127.0.0.1. Vite's default `localhost` bind
		// is ::1-only on this host, so IPv4 browsers get connection refused.
		allowedHosts: true,
		host: true,
		port: 3001,
		strictPort: true,
	},
});
