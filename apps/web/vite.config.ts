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
		// Cursor port detection and forwarding use IPv4 (127.0.0.1 / 0.0.0.0).
		// `host: true` dual-stack-binds `::`, which never appears in /proc/net/tcp.
		allowedHosts: true,
		host: "0.0.0.0",
		port: 3001,
		strictPort: true,
	},
});
