import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { getPodcastFromFeed } from "@podverse/podcast-feed-parser";
import { error, json } from "itty-router";
import { mkFetchHandler } from "./handler.js";
import feedJson from "./test/lastoriaingiallo.json" with { type: "json" };
import expectedJson from "./test/lastoriaingiallo.parsed.json" with {
	type: "json",
};
import { parseFeed } from "./test/parse-feed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const englishHtmlPath = path.join(__dirname, "english.html");
const italianHtmlPath = path.join(__dirname, "italian.html");

const baseUrl = new URL("https://test.dev/");
const raiBaseUrl = new URL("https://rai.dev/");
const mediaBaseUrl = new URL("https://media.dev/");

const fetchFn: typeof fetch = async (input, init) => {
	const requestUrlStr = input.toString();

	if (requestUrlStr === "https://rai.dev/programmi/lastoriaingiallo.json") {
		return json(feedJson);
	}
	if (requestUrlStr === "https://rai.dev/programmi/500.json") {
		return error(500, "internal server error");
	}
	if (requestUrlStr === "https://rai.dev/programmi/corrupt.json") {
		return json({ foo: "bar" });
	}

	const relinkerUrlStart = `${raiBaseUrl}relinker/relinkerServlet.htm?cont=`;
	if (init?.method === "HEAD" && requestUrlStr.startsWith(relinkerUrlStart)) {
		const url = `${requestUrlStr.replace(
			relinkerUrlStart,
			mediaBaseUrl.toString(),
		)}.mp3`;
		return {
			url: url,
			headers: new Headers({
				"Content-Type": "audio/mpeg",
				"Content-Length": "123456789",
			}),
		} as Response;
	}

	return error(404, "not found");
};

const fetchHandler = mkFetchHandler({
	englishIndexHtml: readFileSync(englishHtmlPath, "utf8"),
	italianIndexHtml: readFileSync(italianHtmlPath, "utf8"),
	baseUrl,
	raiBaseUrl,
	poolSize: 1,
	fetch: fetchFn,
});

test("english index", async () => {
	const englishIndex = await readFile(englishHtmlPath, "utf8");
	const req = new Request("http://localhost/");
	const resp = await fetchHandler(req);
	const text = await resp.text();

	assert.strictEqual(resp.status, 200);
	assert.strictEqual(resp.headers.get("Content-Language"), "en");
	assert.strictEqual(text, englishIndex);
});

test("italian index", async () => {
	const italianIndex = await readFile(italianHtmlPath, "utf8");
	const req = new Request("http://localhost/", {
		headers: { "Accept-Language": "it" },
	});
	const resp = await fetchHandler(req);
	const text = await resp.text();

	assert.strictEqual(resp.status, 200);
	assert.strictEqual(resp.headers.get("Content-Language"), "it");
	assert.strictEqual(text, italianIndex);
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
