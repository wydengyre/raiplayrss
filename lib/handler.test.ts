import { strict as assert } from "node:assert";
import test from "node:test";
import { mkFetchHandler } from "./handler.js";
import * as logger from "./logger.js";
import { fetchMock } from "./test/fetch-mock.js";
import expectedJson from "./test/lastoriaingiallo.parsed.json" with {
	type: "json",
};
import { parseFeed } from "./test/parse-feed.js";

test("handler", async (t) => {
	await t.test(indexSucccess);
	await t.test(rssFeedSuccess);
	await t.test(rssFeedFail404);
	await t.test(rssFeedFail500);
	await t.test(rssFeedFailCorrupt);
	await t.test(notFound);
});

const baseUrl = new URL("https://test.dev/");
const raiBaseUrl = new URL("https://rai.dev/");

const fetchHandler = mkFetchHandler({
	baseUrl,
	raiBaseUrl,
	poolSize: 1,
	fetch: fetchMock,
	logger: logger.disabled,
});

async function indexSucccess() {
	const req = new Request("arbitrary://arbitrary/");
	const resp = await fetchHandler(req);

	assert.strictEqual(resp.status, 200);
	assert.strictEqual(resp.headers.get("Content-Language"), "it");
	const _text = await resp.text();
	// TODO: check validity of HTML
}

async function rssFeedSuccess() {
	const req = new Request(
		"arbitrary://arbitrary/programmi/lastoriaingiallo.xml",
	);
	const resp = await fetchHandler(req);

	assert.strictEqual(resp.status, 200);
	const feed = await resp.text();
	const parsedFeed = parseFeed(feed);
	assert.deepStrictEqual(parsedFeed, expectedJson);
}

async function rssFeedFail404() {
	const req = new Request("arbitrary://arbitrary/programmi/nonexistent.xml");
	const resp = await fetchHandler(req);

	assert.strictEqual(resp.status, 404);
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>404</code><message>Not Found</message></error>",
	);
}

async function rssFeedFail500() {
	const req = new Request("arbitrary://arbitrary/programmi/500.xml");
	const resp = await fetchHandler(req);

	assert.strictEqual(resp.status, 500);
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>500</code><message>server error</message></error>",
	);
}

async function rssFeedFailCorrupt() {
	const req = new Request("arbitrary://arbitrary/programmi/corrupt.xml");
	const resp = await fetchHandler(req);

	assert.strictEqual(resp.status, 500);
	assert.strictEqual(resp.headers.get("Content-Type"), "application/xml");
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>500</code><message>server error</message></error>",
	);
}

async function notFound() {
	const req = new Request("arbitrary://arbitrary/nonexistent");
	const resp = await fetchHandler(req);

	assert.strictEqual(resp.status, 404);
	const text = await resp.text();
	assert.strictEqual(text, "Not found.");
}
