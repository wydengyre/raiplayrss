import { readFileSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { polyfillNode } from "esbuild-plugin-polyfill-node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const entrypointPath = path.join(
	__dirname,
	"../node_modules/podcast/dist/esm/index.js",
);
const podcastOutPath = path.join(__dirname, "../build/podcast/index.js");
const typesPath = path.join(__dirname, "../node_modules/podcast/dist/types");
const typesOutPath = path.join(__dirname, "../build/podcast");

const copyP = cp(typesPath, typesOutPath, { recursive: true });

const buildP = build({
	entryPoints: [entrypointPath],
	bundle: true,
	format: "esm",
	outfile: podcastOutPath,
	plugins: [polyfillNode({})],
});

await Promise.all([copyP, buildP]);

// this is a horrible hack for some kind of showstopper bug in the output
const outputFileContent = readFileSync(podcastOutPath, "utf-8");
const fixedContent = outputFileContent
	.replace("self.TextEncoder", "globalThis.TextEncoder")
	.replace("self.TextDecoder", "globalThis.TextDecoder");
writeFileSync(podcastOutPath, fixedContent);
