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
		host: "0.0.0.0",
		port: 3001,
		strictPort: true,
	},
});
