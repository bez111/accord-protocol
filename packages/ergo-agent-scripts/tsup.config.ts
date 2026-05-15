import { defineConfig } from "tsup";

export default defineConfig({
  esbuildOptions(options) {
    options.logOverride = {
      ...options.logOverride,
      "empty-import-meta": "silent",
    };
  },
});
