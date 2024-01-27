import { strict as assert } from "node:assert";
import test from "node:test";
import { error, json } from "itty-router";
import { NotFoundError } from "./error.js";
import { ConvertConf, convertFeed } from "./feed.js";
import feedJson from "./test/lastoriaingiallo.json" with { type: "json" };
import expectedJson from "./test/lastoriaingiallo.parsed.json" with {
	type: "json",
};
import { parseFeed } from "./test/parse-feed.js";

test("feed", async (t) => {
	await t.test(convertFeedSuccess);
	await t.test(convertFeed404);
	await t.test(convertFeedNonCompliantJson);
});

const baseUrl = new URL("https://test.dev/");
const raiBaseUrl = new URL("https://rai.dev/");
const poolSize = 5; // arbitrary
const feedFetchFn: typeof fetch = async (input) => {
	assert.strictEqual(input.toString(), "https://rai.dev/programmi/foo.json");
	return json(feedJson);
};
const mediaFetchFn: typeof fetch = async (input) =>
	({
		url: input
			.toString()
			.replace(/.+cont=(.*)/, (_, cont) => `https://media.dev/${cont}.mp3`),
		status: 200,
		headers: new Headers({
			"content-type": "audio/mpeg",
			"content-length": "123456789",
		}),
	}) as Response;

async function convertFeedSuccess() {
	const fetchFn: typeof fetch = async (input) => {
		return input.toString().endsWith("foo.json")
			? feedFetchFn(input)
			: mediaFetchFn(input);
	};
	const conf: ConvertConf = { raiBaseUrl, baseUrl, poolSize, fetch: fetchFn };
	const feed = await convertFeed(conf, "programmi/foo.json");
	const parsed = parseFeed(feed);
	assert.deepStrictEqual(parsed, expectedJson);
}

async function convertFeed404() {
	const fetchFn = async () => error(404, "Not found");
	const conf: ConvertConf = { raiBaseUrl, baseUrl, poolSize, fetch: fetchFn };
	const expectedErr = new NotFoundError(
		new URL("https://rai.dev/programmi/foo.json"),
	);
	await assert.rejects(convertFeed(conf, "programmi/foo.json"), expectedErr);
}

async function convertFeedNonCompliantJson() {
	const fetchFn = async () => json({ foo: "bar" });
	const conf: ConvertConf = { raiBaseUrl, baseUrl, poolSize, fetch: fetchFn };
	const expectedErr = /^Error: failed to parse feed JSON/;
	await assert.rejects(convertFeed(conf, "programmi/foo.json"), expectedErr);
}
