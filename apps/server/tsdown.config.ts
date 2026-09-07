import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	deps: {
		alwaysBundle: [/@cantiara\/.*/],
	},
	entry: "./src/index.ts",
	format: "esm",
	outDir: "./dist",
});
