import { strict as assert } from "node:assert";
import test from "node:test";
import { error, json } from "itty-router";
import {
	Convertor,
	ConvertorConf,
	FeedConf,
	FeedFetcher,
	FetcherConf,
	NotFoundError,
	convertFeed,
} from "./feed.js";
import { Fetcher as MediaFetcher } from "./media.js";
import feedJson from "./test/lastoriaingiallo.json" with { type: "json" };
import expectedJson from "./test/lastoriaingiallo.parsed.json" with {
	type: "json",
};
import { parseFeed } from "./test/parse-feed.js";

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

test("convertFeed", async () => {
	const fetchFn: typeof fetch = async (input) => {
		return input.toString().endsWith("foo.json")
			? feedFetchFn(input)
			: mediaFetchFn(input);
	};
	const conf: FeedConf = { raiBaseUrl, baseUrl, poolSize, fetch: fetchFn };
	const feed = await convertFeed(conf, "programmi/foo.json");
	const parsed = parseFeed(feed);
	assert.deepStrictEqual(parsed, expectedJson);
});

test("convertFeed 404", async () => {
	const fetchFn = async () => error(404, "Not found");
	const conf: FeedConf = { raiBaseUrl, baseUrl, poolSize, fetch: fetchFn };
	const expectedErr = new NotFoundError(
		new URL("https://rai.dev/programmi/foo.json"),
	);
	await assert.rejects(convertFeed(conf, "programmi/foo.json"), expectedErr);
});

test("convertFeed error on non-compliant JSON", async () => {
	const fetchFn = async () => json({ foo: "bar" });
	const conf: FeedConf = { raiBaseUrl, baseUrl, poolSize, fetch: fetchFn };
	const expectedErr = /^Error: failed to parse feed JSON/;
	await assert.rejects(convertFeed(conf, "programmi/foo.json"), expectedErr);
});

test("Fetcher", async () => {
	const conf: FetcherConf = { raiBaseUrl: raiBaseUrl, fetch: feedFetchFn };
	const f = new FeedFetcher(conf);
	const j = await f.fetch("programmi/foo.json");
	assert.deepStrictEqual(j, feedJson);
});

test("Fetcher 404", async () => {
	const fetchFn = async () => error(404, "Not found");
	const conf: FetcherConf = { raiBaseUrl: baseUrl, fetch: fetchFn };
	const f = new FeedFetcher(conf);
	const expectedErr = new NotFoundError(
		new URL("https://test.dev/programmi/foo.json"),
	);
	await assert.rejects(f.fetch("programmi/foo.json"), expectedErr);
});

test("Convertor", async () => {
	const fetcher = new MediaFetcher(mediaFetchFn);
	const conf: ConvertorConf = { raiBaseUrl, poolSize, fetcher };
	const c = new Convertor(conf);
	const feed = await c.convert(feedJson);
	const parsed = parseFeed(feed);
	assert.deepStrictEqual(parsed, expectedJson);
});

test("Converter error on non-compliant JSON", async () => {
	const fetcher = new MediaFetcher(feedFetchFn);
	const conf: ConvertorConf = { raiBaseUrl, poolSize, fetcher };
	const c = new Convertor(conf);
	await assert.rejects(
		c.convert({ foo: "bar" }),
		/^Error: failed to parse feed JSON: /,
	);
});
