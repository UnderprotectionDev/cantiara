import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    "smart-link-egress": "./src/smart-link-egress.ts",
    "smart-link-egress-worker":
      "./src/features/sources-and-freshness/server/smart-link-egress-worker.ts",
  },
  format: "esm",
  outDir: "./dist",
  clean: true,
  deps: {
    alwaysBundle: [/@cantiara\/.*/],
  },
});
