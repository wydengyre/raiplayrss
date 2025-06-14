import { strict as assert } from "node:assert";
import { type Server, createServer } from "node:http";
import { test } from "node:test";
import { getPodcastFromFeed } from "@podverse/podcast-feed-parser";
import { assertItalian } from "@raiplayrss/server/test/headers.js";
import { createServerAdapter } from "@whatwg-node/server";
import { Router, type RouterType, error, json } from "itty-router";
import { unstable_startWorker } from "wrangler";
import feedJson from "./test/lastoriaingiallo.json" with { type: "json" };
import expectedJson from "./test/lastoriaingiallo.parsed.json" with {
	type: "json",
};

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;

test("worker", async (t) => {
	await t.test(rssFeedSuccess);
	await t.test(rssFeedRai404);
	await t.test(rssFeedRai500);
	await t.test(rssFeedFailProcessing);
	await t.test(notFound);
});

// change for help debugging
const logLevel = "none";

async function rssFeedSuccess() {
	const router = Router();
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
	await using servers = await TestServer.createWithRaiRouter(router);

	// defining this here because we need the server port
	router.get("/programmi/lastoriaingiallo.json", () => {
		const feedJsonCopy = JSON.parse(
			JSON.stringify(feedJson),
		) as typeof feedJson;
		const raiServerPortStr = servers.raiServerPort.toString(10);
		for (const card of feedJsonCopy.block.cards) {
			card.audio.url = card.audio.url.replace(
				"RAI_SERVER_PORT",
				raiServerPortStr,
			);
		}
		return json(feedJsonCopy);
	});

	const resp = await servers.get("programmi/lastoriaingiallo.xml");
	assert(resp.ok);
	assert.strictEqual(resp.status, 200);
	assertItalian(resp);

	const feed = await resp.text();
	const parsedFeed = parseFeed(feed);

	const expectedJsonCopy = { ...expectedJson };
	expectedJsonCopy.meta.imageURL = expectedJsonCopy.meta.imageURL.replace(
		"RAI_SERVER_PORT",
		servers.raiServerPort.toString(10),
	);
	for (const episode of expectedJsonCopy.episodes) {
		episode.enclosure.url = episode.enclosure.url.replace(
			"RAI_SERVER_PORT",
			servers.raiServerPort.toString(10),
		);
		episode.imageURL = episode.imageURL.replace(
			"RAI_SERVER_PORT",
			servers.raiServerPort.toString(10),
		);
	}
	assert.deepStrictEqual(parsedFeed, expectedJsonCopy);
}

async function rssFeedRai404() {
	const router = Router();
	router.get("/programmi/404.json", () => {
		return error(404, "Not found");
	});
	await using servers = await TestServer.createWithRaiRouter(router);

	const resp = await servers.get("programmi/404.xml");
	const text = await resp.text();
	assert(!resp.ok);
	assert.strictEqual(resp.status, 500);
	assert.strictEqual(resp.statusText, "Internal Server Error");
	const expected =
		"<error><code>500</code><message>error converting feed programmi/404.json: Error: failed to fetch feed: 404 - Not Found</message></error>";
	assert.strictEqual(text, expected);
}

async function rssFeedRai500() {
	const router = Router();
	router.get("/programmi/500.json", () => {
		return error(500, "RAI server exploded");
	});
	await using servers = await TestServer.createWithRaiRouter(router);

	const resp = await servers.get("programmi/500.xml");
	const text = await resp.text();
	assert(!resp.ok);
	const expected =
		"<error><code>500</code><message>error converting feed programmi/500.json: Error: failed to fetch feed: 500 - Internal Server Error</message></error>";
	assert.strictEqual(text, expected);
}

async function rssFeedFailProcessing() {
	const router = Router();
	router.get("/programmi/invalid.json", () => {
		return json({ foo: "bar" });
	});
	await using servers = await TestServer.createWithRaiRouter(router);

	const resp = await servers.get("programmi/invalid.xml");
	assert(!resp.ok);
	assert.strictEqual(resp.status, 500);
	assert.strictEqual(resp.statusText, "Internal Server Error");
	const text = await resp.text();
	const expected = `<error><code>500</code><message>error converting feed programmi/invalid.json: Error: failed to parse feed JSON: [
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

async function notFound() {
	await using servers = await TestServer.createWithRaiRouter(Router());
	const resp = await servers.get("http://example/foo");

	assert(!resp.ok);
	assert.strictEqual(resp.status, 404);
	assert.strictEqual(resp.statusText, "Not Found");
	const text = await resp.text();
	assert.strictEqual(text, "Not found.");
}

class TestServer {
	readonly #worker: Worker;
	readonly #mockRaiServer: Server;

	private constructor(worker: Worker, mockRaiServer: Server) {
		this.#worker = worker;
		this.#mockRaiServer = mockRaiServer;
	}

	get(path: string): ReturnType<Worker["fetch"]> {
		const url = `http://example/${path}`;
		return this.#worker.fetch(url);
	}

	static async createWithRaiRouter(router: RouterType): Promise<TestServer> {
		const ittyServer = createServerAdapter(router.fetch);
		const httpServer = createServer(ittyServer);
		await new Promise<void>((resolve) =>
			httpServer.listen(undefined, "localhost", resolve),
		);

		const raiAddress = httpServer.address();
		if (raiAddress === null) {
			throw new Error("RAI server address is null");
		}
		if (typeof raiAddress === "string") {
			throw new Error(
				`RAI server address is a string, we want an object: ${raiAddress}`,
			);
		}

		const RAI_BASE_URL = `http://localhost:${raiAddress.port}`;
		const bindings = {
			RAI_BASE_URL: { type: "plain_text", value: RAI_BASE_URL },
			FETCH_QUEUE_SIZE: { type: "plain_text", value: "5" },
			LOG_LEVEL: { type: "plain_text", value: logLevel },
		} as const;

		const worker = await unstable_startWorker({
			entrypoint: "worker.ts",
			bindings,
			dev: { logLevel },
		});

		return new TestServer(worker, httpServer);
	}

	get raiServerPort(): number {
		const raiAddress = this.#mockRaiServer.address();
		if (raiAddress === null) {
			throw new Error("RAI server address is null");
		}
		if (typeof raiAddress === "string") {
			throw new Error(
				`RAI server address is a string, we want an object: ${raiAddress}`,
			);
		}
		return raiAddress.port;
	}

	async [Symbol.asyncDispose](): Promise<void> {
		await this.#mockRaiServer[Symbol.asyncDispose]();
		await this.#worker.dispose();
	}
}

function parseFeed(feed: string): object {
	const parsedFeed = JSON.parse(JSON.stringify(getPodcastFromFeed(feed)));
	const { meta, ...rest } = parsedFeed;
	const { lastBuildDate, ...metaRest } = meta;
	return { meta: metaRest, ...rest };
}
