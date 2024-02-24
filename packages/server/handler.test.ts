import { strict as assert } from "node:assert";
import test from "node:test";
import feedJson from "@raiplayrss/rai/test/lastoriaingiallo.json";
import expectedJson from "@raiplayrss/rai/test/lastoriaingiallo.parsed.json" with {
	type: "json",
};
import { error, json } from "itty-router";
import { parseFeed } from "../rai/test/parse-feed.js";
import { FetchHandler, mkFetchHandler } from "./handler.js";
import * as logger from "./logger.js";
import { assertItalian } from "./test/headers.js";

test("handler", async (t) => {
	await t.test(rssFeedSuccess);
	await t.test(rssFeedFail404);
	await t.test(rssFeedFail500);
	await t.test(rssFeedFailCorrupt);
	await t.test(notFound);
});

const raiBaseUrl = new URL("https://rai.dev/");
const mediaBaseUrl = new URL("https://media.dev/");

async function rssFeedSuccess() {
	const req = new Request(
		"arbitrary://arbitrary/programmi/lastoriaingiallo.xml",
	);
	const fetchMock: typeof fetch = async (input) => {
		const requestUrlStr = input.toString();
		const { pathname, search } = new URL(requestUrlStr);

		if (pathname === "/programmi/lastoriaingiallo.json") {
			return json(feedJson);
		}

		const relinkerRel = "/relinker/relinkerServlet.htm";
		const relinkerSearchStart = "?cont=";
		if (pathname === relinkerRel) {
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

		throw new Error(`unexpected request: ${requestUrlStr}`);
	};
	const fetchHandler = fetchHandlerWithMock(fetchMock);
	const resp = await fetchHandler(req);

	assert.strictEqual(resp.status, 200);
	assertItalian(resp);

	const feed = await resp.text();
	const parsedFeed = parseFeed(feed);
	assert.deepStrictEqual(parsedFeed, expectedJson);
}

async function rssFeedFail404() {
	const req = new Request("arbitrary://arbitrary/programmi/nonexistent.xml");
	const fetchMock = () => Promise.resolve(error(404, "not found"));
	const fetchHandler = fetchHandlerWithMock(fetchMock);
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
	const fetchMock = () => Promise.resolve(error(500, "internal server error"));
	const fetchHandler = fetchHandlerWithMock(fetchMock);
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
	const fetchMock = () => Promise.resolve(json({ foo: "bar" }));
	const fetchHandler = fetchHandlerWithMock(fetchMock);
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
	const url = new URL("arbitrary://arbitrary/nonexistent");
	const req = new Request(url);
	const fetchMock = () =>
		Promise.reject(new Error("this should never be called"));
	const fetchHandler = fetchHandlerWithMock(fetchMock);
	const resp = await fetchHandler(req);

	assert.strictEqual(resp.status, 404);
	const text = await resp.text();
	assert.strictEqual(text, "Not found.");
}

const confWithFetch = (fetch: typeof globalThis.fetch) => ({
	raiBaseUrl,
	poolSize: 1,
	fetch,
	logger: logger.disabled,
});

function fetchHandlerWithMock(fetch: typeof globalThis.fetch): FetchHandler {
	const conf = confWithFetch(fetch);
	return mkFetchHandler(conf);
}
