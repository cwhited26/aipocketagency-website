import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // tsconfig sets jsx: preserve for Next; the test transform needs the automatic runtime so
  // .test.ts files can import .tsx page/component modules (the /workshop sales-page render test,
  // PA-POS-38). Vite 8 transforms with oxc, so the override lives under `oxc`.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
