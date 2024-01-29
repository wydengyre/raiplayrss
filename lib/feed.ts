import { PromisePool } from "@supercharge/promise-pool";
import { z } from "zod";
import { Podcast } from "../build/podcast/index.js";
import { NotFoundError } from "./error.js";
import { fetchInfo } from "./media.js";

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

export type ConvertConf = {
	raiBaseUrl: URL;
	baseUrl: URL;
	poolSize: number;
	fetch: typeof fetch;
};
export async function convertFeed(
	c: ConvertConf,
	relUrl: string,
): Promise<string> {
	const convertor = new Convertor({
		raiBaseUrl: c.raiBaseUrl,
		poolSize: c.poolSize,
		fetch: c.fetch,
	});
	const feedJson = await fetchFeed(c, relUrl);
	return convertor.convert(feedJson);
}

type FetcherConf = {
	raiBaseUrl: URL;
	fetch: typeof fetch;
};

async function fetchFeed(
	{ raiBaseUrl, fetch }: FetcherConf,
	relUrl: string,
): Promise<unknown> {
	const url = new URL(relUrl, raiBaseUrl);
	const res = await fetch(url);
	if (!res.ok) {
		if (res.status === 404) {
			throw new NotFoundError(url, "fetching feed");
		}
		throw new Error(
			`Failed to fetch ${url}: ${res.status} ${res.statusText}`.trim(),
		);
	}
	return res.json();
}

type ConvertorConf = {
	raiBaseUrl: URL;
	poolSize: number;
	fetch: typeof fetch;
};

class Convertor {
	readonly #raiBaseUrl: URL;
	readonly #poolSize: number;
	readonly #fetch: typeof fetch;

	constructor({ raiBaseUrl, poolSize, fetch }: ConvertorConf) {
		this.#raiBaseUrl = raiBaseUrl;
		this.#poolSize = poolSize;
		this.#fetch = fetch;
	}

	// TODO: feedUrl, siteUrl
	async convert(json: unknown): Promise<string> {
		const parseResult = await schema.safeParseAsync(json);
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
		const mediaInfo = await fetchInfo(this.#fetch, card.downloadable_audio.url);
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
