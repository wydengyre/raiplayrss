import { PromisePool } from "@supercharge/promise-pool";
import { z } from "zod";
import { Podcast } from "../build/podcast/index.js";
import { Fetcher as MediaFetcher } from "./media.js";

const cardSchema = z.object({
	episode_title: z.string(),
	description: z.string(),
	image: z.string(),
	downloadable_audio: z.object({
		url: z.string().url(),
	}),
	track_info: z.object({
		date: z.string(),
	}),
});
type Card = z.infer<typeof cardSchema>;

const schema = z.object({
	title: z.string(),
	podcast_info: z.object({
		description: z.string(),
		image: z.string(),
	}),
	block: z.object({
		cards: z.array(cardSchema),
	}),
});

export type FeedConf = {
	raiBaseUrl: URL;
	baseUrl: URL;
	poolSize: number;
	fetch?: typeof fetch;
};
export async function convertFeed(
	c: FeedConf,
	relUrl: string,
): Promise<string> {
	const fetcher = new FeedFetcher({ raiBaseUrl: c.raiBaseUrl, fetch: c.fetch });
	const mediaFetcher = new MediaFetcher(c.fetch);
	const convertor = new Convertor({
		raiBaseUrl: c.raiBaseUrl,
		poolSize: c.poolSize,
		fetcher: mediaFetcher,
	});
	const feedJson = await fetcher.fetch(relUrl);
	return convertor.convert(feedJson);
}

export type FetcherConf = {
	raiBaseUrl: URL;
	fetch?: typeof fetch;
};

export class FeedFetcher {
	readonly #baseUrl: URL;
	readonly #fetch: typeof fetch;

	constructor(conf: FetcherConf) {
		this.#baseUrl = conf.raiBaseUrl;
		this.#fetch = conf.fetch ?? fetch.bind(globalThis);
	}

	async fetch(relUrl: string): Promise<unknown> {
		const url = new URL(relUrl, this.#baseUrl);
		const res = await this.#fetch(url);
		if (!res.ok) {
			if (res.status === 404) {
				throw new NotFoundError(url);
			}
			throw new Error(
				`Failed to fetch ${url}: ${res.status} ${res.statusText}`.trim(),
			);
		}
		return res.json();
	}
}

export class NotFoundError extends Error {
	constructor(url: URL) {
		super(`Not found: ${url}`);
		this.name = "NotFoundError";
	}
}

export type ConvertorConf = {
	raiBaseUrl: URL;
	poolSize: number;
	fetcher: MediaFetcher;
};

export class Convertor {
	readonly #raiBaseUrl: URL;
	readonly #poolSize: number;
	readonly #fetcher: MediaFetcher;

	constructor({ raiBaseUrl, poolSize, fetcher }: ConvertorConf) {
		this.#raiBaseUrl = raiBaseUrl;
		this.#poolSize = poolSize;
		this.#fetcher = fetcher;
	}

	// TODO: feedUrl, siteUrl
	async convert(json: unknown): Promise<string> {
		const parseResult = schema.safeParse(json);
		if (!parseResult.success) {
			throw new Error(`failed to parse feed JSON: ${parseResult.error}`);
		}
		const feed = parseResult.data;

		// TODO: categories

		const imageUrl = new URL(
			feed.podcast_info.image,
			this.#raiBaseUrl,
		).toString();

		const options = {
			// feedUrl: TODO
			// siteUrl: TODO
			imageUrl,
			title: feed.title,
			description: feed.podcast_info.description,
		};

		const { results } = await PromisePool.for(feed.block.cards)
			.withConcurrency(this.#poolSize)
			.useCorrespondingResults()
			.handleError(async (err, card) => {
				throw new Error(
					`Failed to convert card ${card.episode_title}: ${err.message}`,
				);
			})
			.process(this.convertCard.bind(this));

		return new Podcast(options, results).buildXml();
	}

	async convertCard(card: Card) {
		const imageUrl = new URL(card.image, this.#raiBaseUrl).toString();
		const date = new Date(card.track_info.date);
		const mediaInfo = await this.#fetcher.fetchInfo(
			card.downloadable_audio.url,
		);
		const url = mediaInfo.url.toString();
		return {
			title: card.episode_title,
			description: card.description,
			date,
			imageUrl,
			enclosure: { url, size: mediaInfo.size, type: "audio/mpeg" },
		};
	}
}
