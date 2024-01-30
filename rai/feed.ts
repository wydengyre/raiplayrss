import { PromisePool } from "@supercharge/promise-pool";
import { z } from "zod";
import { Podcast } from "../build/podcast/index.js";
import { FetchWithErr } from "./fetch.js";
import * as media from "./media.js";

export { RssConvertConf, feedToRss };

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

type RssConvertConf = {
	raiBaseUrl: URL;
	baseUrl: URL;
	poolSize: number;
	fetchWithErr: FetchWithErr;
};
async function feedToRss(c: RssConvertConf, relUrl: string): Promise<string> {
	const fetchInfo = media.mkFetchInfo(c.fetchWithErr);
	const convertor = new RssConvertor({
		raiBaseUrl: c.raiBaseUrl,
		poolSize: c.poolSize,
		fetchInfo,
	});
	const url = new URL(relUrl, c.raiBaseUrl);
	const resp = await c.fetchWithErr(url);
	const json = await resp.json();
	return convertor.convert(json);
}

type RssConvertorConf = {
	raiBaseUrl: URL;
	poolSize: number;
	fetchInfo: media.FetchInfo;
};

class RssConvertor {
	readonly #raiBaseUrl: URL;
	readonly #poolSize: number;
	readonly #fetchInfo: media.FetchInfo;

	constructor({ raiBaseUrl, poolSize, fetchInfo }: RssConvertorConf) {
		this.#raiBaseUrl = raiBaseUrl;
		this.#poolSize = poolSize;
		this.#fetchInfo = fetchInfo;
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
		const mediaInfo = await this.#fetchInfo(card.downloadable_audio.url);
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
