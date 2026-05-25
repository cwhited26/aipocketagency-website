import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, "../public/brand/hero.svg");
const outPath = resolve(__dirname, "../public/brand/hero.png");

const svg = readFileSync(svgPath, "utf8");

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
});

const rendered = resvg.render();
const png = rendered.asPng();
writeFileSync(outPath, png);
console.log("Exported:", outPath);
