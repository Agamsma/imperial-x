// MapLibre v6 runs its map worker as a separate ES module. Next.js does not
// bundle it, so copy the worker files into public/ where the page can load them.
import { copyFileSync, mkdirSync } from "node:fs";

const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];
mkdirSync("public/maplibre", { recursive: true });
for (const f of files) copyFileSync(`node_modules/maplibre-gl/dist/${f}`, `public/maplibre/${f}`);
console.log("Copied MapLibre worker to public/maplibre");
