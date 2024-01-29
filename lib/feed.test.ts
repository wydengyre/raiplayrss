import { strict as assert } from "node:assert";
import test from "node:test";
import { json } from "itty-router";
import { ConvertConf, convertFeed } from "./feed.js";
import { FetchWithErr, NotOk, OkResponse } from "./fetch.js";
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

const feedFetchFn: FetchWithErr = () =>
	Promise.resolve(json(feedJson) as OkResponse);
const mediaFetchFn: FetchWithErr = (input) =>
	Promise.resolve({
		url: input
			.toString()
			.replace(/.+cont=(.*)/, (_, cont) => `https://media.dev/${cont}.mp3`),
		status: 200,
		headers: new Headers({
			"content-type": "audio/mpeg",
			"content-length": "123456789",
		}),
	} as OkResponse);

async function convertFeedSuccess() {
	const fetchWithErr: FetchWithErr = async (input) => {
		return input.toString().endsWith("foo.json")
			? feedFetchFn(input)
			: mediaFetchFn(input);
	};
	const conf: ConvertConf = { raiBaseUrl, baseUrl, poolSize, fetchWithErr };
	const feed = await convertFeed(conf, "programmi/foo.json");
	const parsed = parseFeed(feed);
	assert.deepStrictEqual(parsed, expectedJson);
}

async function convertFeed404() {
	const url = new URL("https://rai.dev/programmi/foo.json");
	const notFound = new NotOk(url, 404, "Not Found");
	const fetchWithErr = () => Promise.reject(notFound);
	const conf: ConvertConf = { raiBaseUrl, baseUrl, poolSize, fetchWithErr };
	await assert.rejects(convertFeed(conf, "programmi/foo.json"), notFound);
}

async function convertFeedNonCompliantJson() {
	const fetchWithErr = () =>
		Promise.resolve(json({ foo: "bar" }) as OkResponse);
	const conf: ConvertConf = { raiBaseUrl, baseUrl, poolSize, fetchWithErr };
	const expectedErr = /^Error: failed to parse feed JSON/;
	await assert.rejects(convertFeed(conf, "programmi/foo.json"), expectedErr);
}
