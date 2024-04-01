import { strict as assert } from "node:assert";
import { type Server, createServer } from "node:http";
import { test } from "node:test";
import { getPodcastFromFeed } from "@podverse/podcast-feed-parser";
import { assertItalian } from "@raiplayrss/server/test/headers.js";
import { createServerAdapter } from "@whatwg-node/server";
import { Router, type RouterType, error, json } from "itty-router";
import { type UnstableDevWorker, unstable_dev } from "wrangler";
import feedJson from "./test/lastoriaingiallo.json" with { type: "json" };
import expectedJson from "./test/lastoriaingiallo.parsed.json" with {
	type: "json",
};

test("worker", async (t) => {
	await t.test(rssFeedSuccess);
	await t.test(rssFeedRai404);
	await t.test(rssFeedRai500);
	await t.test(rssFeedFailProcessing);
	await t.test(notFound);
});

// uncomment the relevant line in startWorker() for this to take effect
const logLevel = "info";

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
	await using servers = await Servers.createWithRaiRouter(router);

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

	const resp = await servers.worker.fetch("/programmi/lastoriaingiallo.xml");
	assert(resp.ok);
	assert.strictEqual(resp.status, 200);
	assertItalian(resp);

	const feed = await resp.text();
	const parsedFeed = parseFeed(feed);

	const expectedJsonCopy = JSON.parse(
		JSON.stringify(expectedJson),
	) as typeof expectedJson;
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
	await using servers = await Servers.createWithRaiRouter(router);

	const resp = await servers.worker.fetch("/programmi/404.xml");
	assert(!resp.ok);
	assert.strictEqual(resp.status, 500);
}

async function rssFeedRai500() {
	const router = Router();
	router.get("/programmi/500.json", () => {
		return error(500, "RAI server exploded");
	});
	await using servers = await Servers.createWithRaiRouter(router);

	const resp = await servers.worker.fetch("/programmi/500.xml");
	assert(!resp.ok);
	assert.strictEqual(resp.status, 500);
}

async function rssFeedFailProcessing() {
	const router = Router();
	router.get("/programmi/invalid.json", () => {
		return json({ foo: "bar" });
	});
	await using servers = await Servers.createWithRaiRouter(router);

	const resp = await servers.worker.fetch("/programmi/invalid.xml");
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
	await using servers = await Servers.createWithRaiRouter(Router());
	const resp = await servers.worker.fetch("foo");

	assert(!resp.ok);
	assert.strictEqual(resp.status, 404);
	assert.strictEqual(resp.statusText, "Not Found");
	const text = await resp.text();
	assert.strictEqual(text, "Not found.");
}

class Servers {
	readonly worker: UnstableDevWorker;
	readonly #mockRaiServer: Server;

	private constructor(worker: UnstableDevWorker, mockRaiServer: Server) {
		this.worker = worker;
		this.#mockRaiServer = mockRaiServer;
	}

	static async createWithRaiRouter(router: RouterType): Promise<Servers> {
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
		const vars = {
			RAI_BASE_URL,
			FETCH_QUEUE_SIZE: Number(5).toString(),
			LOG_LEVEL: logLevel,
		};

		const experimental = { disableExperimentalWarning: true };
		const worker = await unstable_dev("worker.ts", {
			// uncomment for help debugging
			// logLevel,
			experimental,
			vars,
		});

		return new Servers(worker, httpServer);
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
		await this.worker.stop();
	}
}

function parseFeed(feed: string): object {
	const parsedFeed = JSON.parse(JSON.stringify(getPodcastFromFeed(feed)));
	const { meta, ...rest } = parsedFeed;
	const { lastBuildDate, ...metaRest } = meta;
	return { meta: metaRest, ...rest };
}
