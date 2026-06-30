// Copy non-compiled assets into dist/ after the TypeScript build: the renderer's HTML/CSS and the
// tray icons (so the packaged app can load them at runtime). Compiled .js is emitted by tsc.

import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Renderer static files (everything under src/renderer except .ts sources).
cpSync(join(root, "src/renderer"), join(root, "dist/renderer"), {
  recursive: true,
  filter: (src) => !src.endsWith(".ts"),
});

// Tray icons → dist/assets (referenced at runtime via __dirname/../assets).
mkdirSync(join(root, "dist/assets"), { recursive: true });
for (const file of ["trayTemplate.png", "trayTemplate@2x.png"]) {
  const src = join(root, "assets", file);
  if (existsSync(src)) {
    cpSync(src, join(root, "dist/assets", file));
  } else {
    console.error(`[copy-assets] WARNING: missing ${src} (run: npm run gen:icons)`);
  }
}

console.log("[copy-assets] done");
