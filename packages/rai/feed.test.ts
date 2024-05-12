import { strict as assert } from "node:assert";
import test from "node:test";
import { error, json } from "itty-router";
import { type RssConvertConf, feedToRss } from "./feed.js";
import feedJson from "./test/lastoriaingiallo.json" with { type: "json" };
import expectedJson from "./test/lastoriaingiallo.parsed.json" with {
	type: "json",
};
import feedJson610 from "./test/lilloegreg610.json" with { type: "json" };
import expectedJson610 from "./test/lilloegreg610.parsed.json" with {
	type: "json",
};
import { parseFeed } from "./test/parse-feed.js";

test("feed", async (t) => {
	await t.test(convertFeedSuccess);
	await t.test(convertFeedNoDescriptionSuccess);
	await t.test(convertFeed610Success);
	await t.test(convertFeed404);
	await t.test(convertFeedNonCompliantJson);
	await t.test(convertFeedEscapingIssues);
});

const raiBaseUrl = new URL("https://rai.dev/");
const poolSize = 5; // arbitrary
const logger = { info: () => {} };

const mediaFetchFn: typeof fetch = (input) =>
	Promise.resolve({
		ok: true,
		url: input
			.toString()
			.replace(/.+cont=(.*)/, (_, cont) => `https://media.dev/${cont}.mp3`),
		status: 200,
		headers: new Headers({
			"content-type": "audio/mpeg",
			"content-length": "123456789",
		}),
	} as Response);

async function convertFeedSuccess() {
	const fetch: typeof globalThis.fetch = async (input) => {
		return input.toString().endsWith("foo.json")
			? Promise.resolve(json(feedJson))
			: mediaFetchFn(input);
	};
	const conf: RssConvertConf = { raiBaseUrl, poolSize, fetch, logger };
	const feed = await feedToRss(conf, "programmi/foo.json");
	const parsed = parseFeed(feed);
	assert.deepStrictEqual(parsed, expectedJson);
}

async function convertFeedNoDescriptionSuccess() {
	const noEpisodeDescriptionFeed = {
		...feedJson,
		block: {
			...feedJson.block,
			cards: feedJson.block.cards.map((card) => {
				const { description, ...copy } = card;
				return copy;
			}),
		},
	};

	const noEpisodeDescriptionExpected = {
		...expectedJson,
		episodes: expectedJson.episodes.map((episode) => ({
			...episode,
			description: "",
			summary: "",
		})),
	};
	const fetch: typeof globalThis.fetch = async (input) => {
		return input.toString().endsWith("foo.json")
			? Promise.resolve(json(noEpisodeDescriptionFeed))
			: mediaFetchFn(input);
	};
	const conf: RssConvertConf = { raiBaseUrl, poolSize, fetch, logger };
	const feed = await feedToRss(conf, "programmi/foo.json");
	const parsed = parseFeed(feed);
	assert.deepStrictEqual(parsed, noEpisodeDescriptionExpected);
}

async function convertFeed610Success() {
	const fetch: typeof globalThis.fetch = async (input) => {
		return input.toString().endsWith("foo.json")
			? Promise.resolve(json(feedJson610))
			: mediaFetchFn(input);
	};
	const conf: RssConvertConf = { raiBaseUrl, poolSize, fetch, logger };
	const feed = await feedToRss(conf, "programmi/foo.json");
	const parsed = parseFeed(feed);
	assert.deepStrictEqual(parsed, expectedJson610);
}

async function convertFeed404() {
	const url = new URL("https://rai.dev/programmi/foo.json");
	const fetch = () => Promise.resolve(error(404));
	const conf: RssConvertConf = { raiBaseUrl, poolSize, fetch, logger };
	await assert.rejects(feedToRss(conf, "programmi/foo.json"));
}

async function convertFeedNonCompliantJson() {
	const fetch = () => Promise.resolve(json({ foo: "bar" }));
	const conf: RssConvertConf = { raiBaseUrl, poolSize, fetch, logger };
	const expectedErr = /^Error: failed to parse feed JSON/;
	await assert.rejects(feedToRss(conf, "programmi/foo.json"), expectedErr);
}

async function convertFeedEscapingIssues() {
	const mediaFetchWithIllegalChars: typeof fetch = async (input) => {
		const resp = await mediaFetchFn(input);
		return {
			...resp,
			url: `${resp.url}&ampersands_are=evil`,
		};
	};
	const fetch: typeof globalThis.fetch = async (input) => {
		return input.toString().endsWith("foo.json")
			? Promise.resolve(json(feedJson))
			: mediaFetchWithIllegalChars(input);
	};

	const adjustedJson: typeof expectedJson = { ...expectedJson };
	for (const episode of adjustedJson.episodes) {
		episode.enclosure.url = `${episode.enclosure.url}&ampersands_are=evil`;
	}
	const conf: RssConvertConf = { raiBaseUrl, poolSize, fetch, logger };
	const feed = await feedToRss(conf, "programmi/foo.json");
	const parsed = parseFeed(feed);
	assert.deepStrictEqual(parsed, adjustedJson);
}
