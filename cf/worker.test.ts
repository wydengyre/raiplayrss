import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { Server, createServer } from "node:http";
import * as path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { getPodcastFromFeed } from "@podverse/podcast-feed-parser";
import { createServerAdapter } from "@whatwg-node/server";
import { Router, RouterType, error, json } from "itty-router";
import { UnstableDevWorker, unstable_dev } from "wrangler";
import feedJson from "./test/lastoriaingiallo.json" with { type: "json" };
import expectedJson from "./test/lastoriaingiallo.parsed.json" with {
	type: "json",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const englishHtmlPath = path.join(__dirname, "../lib/english.html");
const italianHtmlPath = path.join(__dirname, "../lib/italian.html");

let worker: UnstableDevWorker;

before(async () => {
	const experimental = { disableExperimentalWarning: true };
	worker = await unstable_dev("cf/worker.ts", {
		// uncomment and change level for help debugging
		// logLevel: "info",
		experimental,
	});
});

after(async () => {
	await worker.stop();
});

test("english index", async () => {
	const englishIndex = await readFile(englishHtmlPath, "utf8");
	const resp = await worker.fetch();
	const text = await resp.text();

	assert(resp.ok);
	assert.strictEqual(resp.status, 200);
	assert.strictEqual(resp.statusText, "OK");
	assert.strictEqual(resp.headers.get("Content-Language"), "en");
	assert.strictEqual(text, englishIndex);
});

test("italian index", async () => {
	const italianIndex = await readFile(italianHtmlPath, "utf8");
	const resp = await worker.fetch("", { headers: { "Accept-Language": "it" } });
	const text = await resp.text();

	assert(resp.ok);
	assert.strictEqual(resp.status, 200);
	assert.strictEqual(resp.statusText, "OK");
	assert.strictEqual(resp.headers.get("Content-Language"), "it");
	assert.strictEqual(text, italianIndex);
});

test("rss feed success", async () => {
	const router = Router();
	router.get("/programmi/lastoriaingiallo.json", () => {
		return json(feedJson);
	});
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

	const feed = await resp.text();
	const parsedFeed = parseFeed(feed);

	const trulyExpectedJSON = replaceImageUrls(replaceMediaUrls(expectedJson));
	trulyExpectedJSON.meta.imageURL = trulyExpectedJSON.meta.imageURL.replace(
		/^https:\/\/test.dev\//,
		"http://localhost:8091/",
	);
	assert.deepStrictEqual(parsedFeed, trulyExpectedJSON);
});

test("rss feed failure: 404 from RAI server", async () => {
	const router = Router();
	router.get("/programmi/404.json", () => {
		return error(404, "Not found");
	});
	await using _ = await MockRaiServer.create(router);

	const resp = await worker.fetch("/programmi/404.xml");
	assert(!resp.ok);
	assert.strictEqual(resp.status, 404);
});

test("rss feed failure: 500 from RAI server", async () => {
	const router = Router();
	router.get("/programmi/500.json", () => {
		return error(500, "RAI server exploded");
	});
	await using _ = await MockRaiServer.create(router);

	const resp = await worker.fetch("/programmi/500.xml");
	assert(!resp.ok);
	assert.strictEqual(resp.status, 500);
});

test("rss feed failure: failure to process RAI json feed", async () => {
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
});

test("404", async () => {
	const resp = await worker.fetch("foo");

	assert(!resp.ok);
	assert.strictEqual(resp.status, 404);
	assert.strictEqual(resp.statusText, "Not Found");
	const text = await resp.text();
	assert.strictEqual(text, "Not found.");
});

class MockRaiServer {
	#server: Server;

	private constructor(server: Server) {
		this.#server = server;
	}

	static async create(router: RouterType): Promise<MockRaiServer> {
		const { RAI_BASE_URL } = process.env;
		if (RAI_BASE_URL === undefined) {
			throw new Error("RAI_BASE_URL is undefined");
		}
		const url = new URL(RAI_BASE_URL);
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
