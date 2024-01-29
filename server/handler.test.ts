import { strict as assert } from "node:assert";
import test from "node:test";
import { error, json } from "itty-router";
import genresJson from "../rai/test/generi.json";
import feedJson from "../rai/test/lastoriaingiallo.json";
import expectedJson from "../rai/test/lastoriaingiallo.parsed.json" with {
	type: "json",
};
import { parseFeed } from "../rai/test/parse-feed.js";
import { mkFetchHandler } from "./handler.js";
import * as logger from "./logger.js";

test("handler", async (t) => {
	await t.test(indexSuccess);
	await test(rssFeedSuccess);
	await t.test(rssFeedFail404);
	await t.test(rssFeedFail500);
	await t.test(rssFeedFailCorrupt);
	await t.test(notFound);
});

const baseUrl = new URL("https://test.dev/");
const raiBaseUrl = new URL("https://rai.dev/");
const mediaBaseUrl = new URL("https://media.dev/");

async function indexSuccess() {
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
		"<error><code>404</code><message>not found</message></error>",
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

const fetchMock: typeof fetch = async (input, init) => {
	const requestUrlStr = input.toString();
	const { protocol, hostname, pathname, search } = new URL(requestUrlStr);

	if (!(protocol === raiBaseUrl.protocol && hostname === raiBaseUrl.hostname)) {
		throw new Error(`unexpected request to ${requestUrlStr}`);
	}

	if (pathname === "/generi.json") {
		return json(genresJson);
	}

	if (pathname === "/programmi/lastoriaingiallo.json") {
		return json(feedJson);
	}
	if (pathname === "/programmi/500.json") {
		return error(500, "internal server error");
	}
	if (pathname === "/programmi/corrupt.json") {
		return json({ foo: "bar" });
	}

	const relinkerRel = "/relinker/relinkerServlet.htm";
	const relinkerSearchStart = "?cont=";
	if (
		init?.method === "HEAD" &&
		pathname === relinkerRel &&
		search.startsWith(relinkerSearchStart)
	) {
		const urlStart = requestUrlStr.replace(
			new URL(`${relinkerRel}${relinkerSearchStart}`, raiBaseUrl).toString(),
			mediaBaseUrl.toString(),
		);
		const url = `${urlStart}.mp3`;
		return {
			url: url,
			headers: new Headers({
				"Content-Type": "audio/mpeg",
				"Content-Length": "123456789",
			}),
			ok: true,
		} as Response;
	}

	return error(404, "not found");
};

const fetchHandler = mkFetchHandler({
	baseUrl,
	raiBaseUrl,
	poolSize: 1,
	fetch: fetchMock,
	logger: logger.disabled,
});
