import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { fetchFn } from "./feed-handler.test.js";
import { mkFetchHandler } from "./handler.js";
import * as logger from "./logger.js";
import expectedJson from "./test/lastoriaingiallo.parsed.json" with {
	type: "json",
};
import { parseFeed } from "./test/parse-feed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexHtmlPath = path.join(__dirname, "index.html");

const baseUrl = new URL("https://test.dev/");
const raiBaseUrl = new URL("https://rai.dev/");
const indexHtml = readFileSync(indexHtmlPath, "utf8");

const fetchHandler = mkFetchHandler({
	indexHtml,
	baseUrl,
	raiBaseUrl,
	poolSize: 1,
	fetch: fetchFn,
	logger: logger.disabled,
});

test("index", async () => {
	const req = new Request("http://localhost/");
	const resp = await fetchHandler(req);

	assert.strictEqual(resp.status, 200);
	assert.strictEqual(resp.headers.get("Content-Language"), "it");
	const text = await resp.text();
	assert.strictEqual(text, indexHtml);
});

test("rss feed success", async () => {
	const req = new Request("https://test.dev/programmi/lastoriaingiallo.xml");
	const resp = await fetchHandler(req);

	assert.strictEqual(resp.status, 200);
	const feed = await resp.text();
	const parsedFeed = parseFeed(feed);
	assert.deepStrictEqual(parsedFeed, expectedJson);
});

test("rss feed failure: 404 from RAI server", async () => {
	const req = new Request("https://test.dev/programmi/nonexistent.xml");
	const resp = await fetchHandler(req);
	assert.strictEqual(resp.status, 404);
	assert.strictEqual(resp.headers.get("Content-Type"), "application/xml");
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>404</code><message>Not Found</message></error>",
	);
});

test("rss feed failure: 500 from RAI server", async () => {
	const req = new Request("https://test.dev/programmi/500.xml");
	const resp = await fetchHandler(req);
	assert.strictEqual(resp.status, 500);
	assert.strictEqual(resp.headers.get("Content-Type"), "application/xml");
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>500</code><message>server error</message></error>",
	);
});

test("rss feed failure: failure to process RAI json feed", async () => {
	const req = new Request("https://test.dev/programmi/corrupt.xml");
	const resp = await fetchHandler(req);
	assert.strictEqual(resp.status, 500);
	assert.strictEqual(resp.headers.get("Content-Type"), "application/xml");
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>500</code><message>server error</message></error>",
	);
});

test("404", async () => {
	const req = new Request("https://test.dev/nonexistent");
	const resp = await fetchHandler(req);

	assert.strictEqual(resp.status, 404);
	const text = await resp.text();
	assert.strictEqual(text, "Not found.");
});
