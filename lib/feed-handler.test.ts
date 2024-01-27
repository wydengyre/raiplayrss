import { strict as assert } from "node:assert";
import test from "node:test";
import { feedHandler } from "./feed-handler.js";
import * as logger from "./logger.js";
import { fetchMock, raiBaseUrl } from "./test/fetch-mock.js";
import expectedJson from "./test/lastoriaingiallo.parsed.json" with {
	type: "json",
};
import { parseFeed } from "./test/parse-feed.js";

const baseUrl = new URL("https://test.dev/");

const conf = {
	baseUrl,
	raiBaseUrl,
	poolSize: 1,
	fetch: fetchMock,
	logger: logger.disabled,
};

test("rss feed success", async () => {
	const req = new Request("https://test.dev/programmi/lastoriaingiallo.xml");
	const resp = await feedHandler(conf, req);

	assert.strictEqual(resp.status, 200);
	const feed = await resp.text();
	const parsedFeed = parseFeed(feed);
	assert.deepStrictEqual(parsedFeed, expectedJson);
});

test("rss feed failure: 404 from RAI server", async () => {
	const req = new Request("https://test.dev/programmi/nonexistent.xml");
	const resp = await feedHandler(conf, req);
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
	const resp = await feedHandler(conf, req);
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
	const resp = await feedHandler(conf, req);
	assert.strictEqual(resp.status, 500);
	assert.strictEqual(resp.headers.get("Content-Type"), "application/xml");
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>500</code><message>server error</message></error>",
	);
});
