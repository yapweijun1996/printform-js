import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, "js/vite-entry.js"),
      name: "PrintForm",
      formats: ["iife"],
      fileName: () => "printform.js"
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"]
  }
});

