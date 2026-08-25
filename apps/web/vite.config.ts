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
		// Cursor port forwarding hits 127.0.0.1. `host: true` binds IPv6 `::` only
		// on this host (no IPv4 LISTEN), so the local tunnel gets connection refused.
		allowedHosts: true,
		host: "0.0.0.0",
		port: 3001,
		strictPort: true,
	},
});
