import { strict as assert } from "node:assert";
import test from "node:test";
import feedJson from "@raiplayrss/rai/test/lastoriaingiallo.json";
import expectedJson from "@raiplayrss/rai/test/lastoriaingiallo.parsed.json" with {
	type: "json",
};
import { json, status } from "itty-router";
import { parseFeed } from "../rai/test/parse-feed.js";
import { feedHandler } from "./feed-handler.js";
import * as logger from "./logger.js";
import { assertItalian } from "./test/headers.js";

test("feed-handler", async (t) => {
	await t.test(rssFeedSuccess);
	await t.test(rssFeedFail404);
	await t.test(rssFeedFail500);
	await t.test(rssFeedFailNonCompliantJson);
});

const raiBaseUrl = new URL("https://rai.dev/");
const mediaBaseUrl = new URL("https://media.dev/");

const confWithFetch = (fetch: typeof globalThis.fetch) => ({
	raiBaseUrl,
	poolSize: 5,
	fetch,
	logger: logger.disabled,
});

async function rssFeedSuccess() {
	const req = new Request("https://test.dev/programmi/lastoriaingiallo.xml");
	const fetchMock: typeof fetch = async (input) => {
		const requestUrlStr = input.toString();
		const url = new URL(requestUrlStr);
		const { pathname, search } = url;

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
				ok: true,
				url: url,
				headers: new Headers({
					"Content-Type": "audio/mpeg",
					"Content-Length": "123456789",
				}),
			} as Response;
		}

		throw new Error(`unexpected request: ${requestUrlStr}`);
	};
	const conf = confWithFetch(fetchMock);
	const resp = await feedHandler(conf, req);

	assert.strictEqual(resp.status, 200);
	assertItalian(resp);
	const feed = await resp.text();
	const parsedFeed = parseFeed(feed);
	assert.deepStrictEqual(parsedFeed, expectedJson);
}

async function rssFeedFail404() {
	const url = new URL("https://test.dev/programmi/nonexistent.xml");
	const req = new Request(url);
	const fetchMock = async () => status(404);
	const conf = confWithFetch(fetchMock);
	const resp = await feedHandler(conf, req);
	assert.strictEqual(resp.status, 500);
	assert.strictEqual(resp.headers.get("Content-Type"), "application/xml");
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>500</code><message>server error</message></error>",
	);
}

async function rssFeedFail500() {
	const url = new URL("https://test.dev/programmi/500.xml");
	const req = new Request(url);
	const fetchMock = async () => status(500);
	const conf = confWithFetch(fetchMock);
	const resp = await feedHandler(conf, req);
	assert.strictEqual(resp.status, 500);
	assert.strictEqual(resp.headers.get("Content-Type"), "application/xml");
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>500</code><message>server error</message></error>",
	);
}

async function rssFeedFailNonCompliantJson() {
	const req = new Request("https://test.dev/programmi/corrupt.xml");
	const fetchMock = async () => json({ foo: "bar" });

	const conf = confWithFetch(fetchMock);
	const resp = await feedHandler(conf, req);
	assert.strictEqual(resp.status, 500);
	assert.strictEqual(resp.headers.get("Content-Type"), "application/xml");
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>500</code><message>server error</message></error>",
	);
}
