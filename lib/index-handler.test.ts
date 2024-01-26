import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { indexHandler } from "./index-handler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const englishHtmlPath = path.join(__dirname, "english.html");
const italianHtmlPath = path.join(__dirname, "italian.html");

const [englishIndexHtml, italianIndexHtml] = await Promise.all([
	await readFile(englishHtmlPath, "utf8"),
	await readFile(italianHtmlPath, "utf8"),
]);

const conf = { englishIndexHtml, italianIndexHtml };
const testUrl = new URL("https://test.dev/");

test("english index", async () => {
	const req = new Request(testUrl);
	const resp = indexHandler(conf, req);

	assert.strictEqual(resp.status, 200);
	assert.strictEqual(resp.headers.get("Content-Language"), "en");
	const text = await resp.text();
	assert.strictEqual(text, englishIndexHtml);
});

test("italian index", async () => {
	const req = new Request(testUrl, { headers: { "Accept-Language": "it" } });
	const resp = indexHandler(conf, req);

	assert.strictEqual(resp.status, 200);
	assert.strictEqual(resp.headers.get("Content-Language"), "it");
	const text = await resp.text();
	assert.strictEqual(text, italianIndexHtml);
});
