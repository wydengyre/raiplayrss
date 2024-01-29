import { strict as assert } from "node:assert";
import test from "node:test";
import { json } from "itty-router";
import { feedHandler } from "./feed-handler.js";
import { FetchWithErr, NotOk, OkResponse } from "./fetch.js";
import * as logger from "./logger.js";
import genresJson from "./test/generi.json";
import feedJson from "./test/lastoriaingiallo.json";
import expectedJson from "./test/lastoriaingiallo.parsed.json" with {
	type: "json",
};
import { parseFeed } from "./test/parse-feed.js";

test("feed-handler", async (t) => {
	await t.test(rssFeedSuccess);
	await t.test(rssFeedFail404);
	await t.test(rssFeedFail500);
	await t.test(rssFeedFailNonCompliantJson);
});

const baseUrl = new URL("https://test.dev/");
const raiBaseUrl = new URL("https://rai.dev/");
const mediaBaseUrl = new URL("https://media.dev/");

const fetchMock: FetchWithErr = async (input, init) => {
	const requestUrlStr = input.toString();
	const url = new URL(requestUrlStr);
	const { protocol, hostname, pathname, search } = url;

	if (!(protocol === raiBaseUrl.protocol && hostname === raiBaseUrl.hostname)) {
		throw new Error(`unexpected request to ${requestUrlStr}`);
	}

	if (pathname === "/generi.json") {
		return json(genresJson) as OkResponse;
	}

	if (pathname === "/programmi/lastoriaingiallo.json") {
		return json(feedJson) as OkResponse;
	}
	if (pathname === "/programmi/500.json") {
		throw new NotOk(url, 500, "server error");
	}
	if (pathname === "/programmi/corrupt.json") {
		return json({ foo: "bar" }) as OkResponse;
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
		} as OkResponse;
	}

	throw new NotOk(url, 404, "not found");
};

const conf = {
	baseUrl,
	raiBaseUrl,
	poolSize: 1,
	fetchWithErr: fetchMock,
	logger: logger.disabled,
};

async function rssFeedSuccess() {
	const req = new Request("https://test.dev/programmi/lastoriaingiallo.xml");
	const resp = await feedHandler(conf, req);

	assert.strictEqual(resp.status, 200);
	const feed = await resp.text();
	const parsedFeed = parseFeed(feed);
	assert.deepStrictEqual(parsedFeed, expectedJson);
}

async function rssFeedFail404() {
	const req = new Request("https://test.dev/programmi/nonexistent.xml");
	const resp = await feedHandler(conf, req);
	assert.strictEqual(resp.status, 404);
	assert.strictEqual(resp.headers.get("Content-Type"), "application/xml");
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>404</code><message>not found</message></error>",
	);
}

async function rssFeedFail500() {
	const req = new Request("https://test.dev/programmi/500.xml");
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
	const resp = await feedHandler(conf, req);
	assert.strictEqual(resp.status, 500);
	assert.strictEqual(resp.headers.get("Content-Type"), "application/xml");
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>500</code><message>server error</message></error>",
	);
}
