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
	const feedPath = "programmi/lastoriaingiallo";
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
	const resp = await feedHandler(conf, feedPath);

	assert.strictEqual(resp.status, 200);
	assertItalian(resp);
	const feed = await resp.text();
	const parsedFeed = parseFeed(feed);
	assert.deepStrictEqual(parsedFeed, expectedJson);
}

async function rssFeedFail404() {
	const feedPath = "programmi/nonexistent.xml";
	const fetchMock = async () => status(404);
	const conf = confWithFetch(fetchMock);
	const resp = await feedHandler(conf, feedPath);
	assert.strictEqual(resp.status, 500);
	assert.strictEqual(resp.headers.get("Content-Type"), "application/xml");
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>500</code><message>error converting feed programmi/nonexistent.xml.json: Error: failed to fetch feed: 404</message></error>",
	);
}

async function rssFeedFail500() {
	const feedPath = "programmi/500.xml";
	const fetchMock = async () => status(500);
	const conf = confWithFetch(fetchMock);
	const resp = await feedHandler(conf, feedPath);
	assert.strictEqual(resp.status, 500);
	assert.strictEqual(resp.headers.get("Content-Type"), "application/xml");
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>500</code><message>error converting feed programmi/500.xml.json: Error: failed to fetch feed: 500</message></error>",
	);
}

async function rssFeedFailNonCompliantJson() {
	const feedPath = "programmi/corrupt.xml";
	const fetchMock = async () => json({ foo: "bar" });

	const conf = confWithFetch(fetchMock);
	const resp = await feedHandler(conf, feedPath);
	assert.strictEqual(resp.status, 500);
	assert.strictEqual(resp.headers.get("Content-Type"), "application/xml");
	const text = await resp.text();

	const expected = `<error><code>500</code><message>error converting feed programmi/corrupt.xml.json: Error: failed to parse feed JSON: [
  {
    &quot;code&quot;: &quot;invalid_type&quot;,
    &quot;expected&quot;: &quot;string&quot;,
    &quot;received&quot;: &quot;undefined&quot;,
    &quot;path&quot;: [
      &quot;title&quot;
    ],
    &quot;message&quot;: &quot;Required&quot;
  },
  {
    &quot;code&quot;: &quot;invalid_type&quot;,
    &quot;expected&quot;: &quot;object&quot;,
    &quot;received&quot;: &quot;undefined&quot;,
    &quot;path&quot;: [
      &quot;podcast_info&quot;
    ],
    &quot;message&quot;: &quot;Required&quot;
  },
  {
    &quot;code&quot;: &quot;invalid_type&quot;,
    &quot;expected&quot;: &quot;object&quot;,
    &quot;received&quot;: &quot;undefined&quot;,
    &quot;path&quot;: [
      &quot;block&quot;
    ],
    &quot;message&quot;: &quot;Required&quot;
  }
]</message></error>`;
	assert.strictEqual(text, expected);
}
