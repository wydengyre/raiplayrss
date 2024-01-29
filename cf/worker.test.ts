import { strict as assert } from "node:assert";
import { Server, createServer } from "node:http";
import { test } from "node:test";
import { getPodcastFromFeed } from "@podverse/podcast-feed-parser";
import { createServerAdapter } from "@whatwg-node/server";
import { Router, RouterType, error, json } from "itty-router";
import { UnstableDevWorker, unstable_dev } from "wrangler";
import genresJson from "../rai/test/generi.json" with { type: "json" };
import { assertItalian } from "../server/test/headers.js";
import feedJson from "./test/lastoriaingiallo.json" with { type: "json" };
import expectedJson from "./test/lastoriaingiallo.parsed.json" with {
	type: "json",
};

test("worker", async (t) => {
	t.before(startWorker);
	t.after(stopWorker);

	await t.test(index);
	await t.test(rssFeedSuccess);
	await t.test(rssFeedRai404);
	await t.test(rssFeedRai500);
	await t.test(rssFeedFailProcessing);
	await t.test(notFound);
});

// uncomment the relevant line in startWorker() for this to take effect
const logLevel = "debug";
const vars = {
	BASE_URL: "https://test.dev/",
	RAI_BASE_URL: "http://localhost:8091/",
	FETCH_QUEUE_SIZE: "5",
	LOG_LEVEL: logLevel,
};

let worker: UnstableDevWorker;
async function startWorker() {
	const experimental = { disableExperimentalWarning: true };
	worker = await unstable_dev("cf/worker.ts", {
		// uncomment for help debugging
		// logLevel,
		experimental,
		vars,
	});
}

async function stopWorker() {
	await worker.stop();
}

class MockRaiServer {
	#server: Server;

	private constructor(server: Server) {
		this.#server = server;
	}

	static async create(router: RouterType): Promise<MockRaiServer> {
		const url = new URL(vars.RAI_BASE_URL);
		const listenPort = parseInt(url.port);

		const ittyServer = createServerAdapter(router);
		const httpServer = createServer(ittyServer);
		await new Promise<void>((resolve) =>
			httpServer.listen(listenPort, url.hostname, resolve),
		);
		return new MockRaiServer(httpServer);
	}

	[Symbol.asyncDispose](): Promise<void> {
		return this.#server[Symbol.asyncDispose]();
	}
}

async function index() {
	const router = Router();
	router.get("/generi.json", () => json(genresJson));
	await using _server = await MockRaiServer.create(router);

	const resp = await worker.fetch("");

	assert(resp.ok);
	assert.strictEqual(resp.status, 200);
	assert.strictEqual(resp.statusText, "OK");
	assertItalian(resp);

	const _text = await resp.text();
	// TODO: validate html
}

async function rssFeedSuccess() {
	const router = Router();
	router.get("/programmi/lastoriaingiallo.json", () => json(feedJson));
	router.head(
		"*",
		() =>
			new Response(null, {
				status: 200,
				headers: {
					"Content-Type": "audio/mpeg",
					"Content-Length": "123456789",
				},
			}),
	);
	await using _server = await MockRaiServer.create(router);

	const resp = await worker.fetch("/programmi/lastoriaingiallo.xml");
	assert(resp.ok);
	assert.strictEqual(resp.status, 200);
	assertItalian(resp);

	const feed = await resp.text();
	const parsedFeed = parseFeed(feed);

	const trulyExpectedJSON = replaceImageUrls(replaceMediaUrls(expectedJson));
	trulyExpectedJSON.meta.imageURL = trulyExpectedJSON.meta.imageURL.replace(
		/^https:\/\/test.dev\//,
		"http://localhost:8091/",
	);
	assert.deepStrictEqual(parsedFeed, trulyExpectedJSON);
}

async function rssFeedRai404() {
	const router = Router();
	router.get("/programmi/404.json", () => {
		return error(404, "Not found");
	});
	await using _ = await MockRaiServer.create(router);

	const resp = await worker.fetch("/programmi/404.xml");
	assert(!resp.ok);
	assert.strictEqual(resp.status, 404);
}

async function rssFeedRai500() {
	const router = Router();
	router.get("/programmi/500.json", () => {
		return error(500, "RAI server exploded");
	});
	await using _ = await MockRaiServer.create(router);

	const resp = await worker.fetch("/programmi/500.xml");
	assert(!resp.ok);
	assert.strictEqual(resp.status, 500);
}

async function rssFeedFailProcessing() {
	const router = Router();
	router.get("/programmi/invalid.json", () => {
		return json({ foo: "bar" });
	});
	await using _server = await MockRaiServer.create(router);

	const resp = await worker.fetch("/programmi/invalid.xml");
	assert(!resp.ok);
	assert.strictEqual(resp.status, 500);
	assert.strictEqual(resp.statusText, "Internal Server Error");
	const text = await resp.text();
	assert.strictEqual(
		text,
		"<error><code>500</code><message>server error</message></error>",
	);
}

async function notFound() {
	const resp = await worker.fetch("foo");

	assert(!resp.ok);
	assert.strictEqual(resp.status, 404);
	assert.strictEqual(resp.statusText, "Not Found");
	const text = await resp.text();
	assert.strictEqual(text, "Not found.");
}

function replaceMediaUrls(j: typeof expectedJson): typeof expectedJson {
	for (const e of j.episodes) {
		e.enclosure.url = e.enclosure.url.replace(
			/^https:\/\/media.test.dev\/(.+)\.mp3$/,
			(_, p1) =>
				`http://localhost:8091/relinker/relinkerServlet.htm?cont=${p1}`,
		);
	}
	return j;
}
function replaceImageUrls(j: typeof expectedJson): typeof expectedJson {
	for (const e of j.episodes) {
		e.imageURL = e.imageURL.replace(
			/^https:\/\/test.dev\//,
			"http://localhost:8091/",
		);
	}
	return j;
}

function parseFeed(feed: string): object {
	const parsedFeed = JSON.parse(JSON.stringify(getPodcastFromFeed(feed)));
	const { meta, ...rest } = parsedFeed;
	const { lastBuildDate, ...metaRest } = meta;
	return { meta: metaRest, ...rest };
}
