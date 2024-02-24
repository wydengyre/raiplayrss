import { PromisePool } from "@supercharge/promise-pool";
import { z } from "zod";
import { FetchWithErr } from "./fetch.js";
import * as media from "./media.js";

export { RssConvertConf, feedToRss };

const cardSchema = z.object({
	episode_title: z.string(),
	description: z.string(),
	image: z.string(),
	audio: z.object({
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

		const image = new URL(feed.podcast_info.image, this.#raiBaseUrl);

		const { results } = await PromisePool.for(feed.block.cards)
			.withConcurrency(this.#poolSize)
			.useCorrespondingResults()
			.handleError(async (err, card) => {
				throw new Error(
					`Failed to convert card ${card.episode_title}: ${err.message}`,
				);
			})
			.process(this.convertCard.bind(this));

		const podcast: Podcast = {
			title: feed.title,
			description: feed.podcast_info.description,
			// TODO: maybe this podcasts have this info?
			language: "it",
			image,
			items: results,
		};

		return podcastRss(podcast);
	}

	async convertCard(card: Card): Promise<PodcastItem> {
		const image = new URL(card.image, this.#raiBaseUrl);
		const pubDate = new Date(card.track_info.date);
		const mediaInfo = await this.#fetchInfo(card.audio.url);
		return {
			title: card.episode_title,
			description: card.description,
			guid: card.episode_title, // TODO: revisit this
			pubDate,
			url: mediaInfo.url,
			length: mediaInfo.size,
			image,
		};
	}
}

// what about category?
type Podcast = {
	title: string;
	description: string;
	language: string; // should it just be italian? Type this better?
	image: URL;
	items: PodcastItem[];
};

type PodcastItem = {
	title: string;
	description: string;
	guid: string; // figure this out (?)
	pubDate: Date;
	url: URL;
	length: number;
	image: URL;
};

function podcastRss(p: Podcast): string {
	const lastBuildDate = new Date().toUTCString();

	const items: string[] = p.items.map((item) => itemRss(item));

	const channel = `<channel>
	<title>${cdata(p.title)}</title>
	<description>${cdata(p.description)}</description>
	<lastBuildDate>${lastBuildDate}</lastBuildDate>
	<itunes:summary>${cdata(p.description)}</itunes:summary>
	<itunes:explicit>false</itunes:explicit>
	<itunes:image href="${p.image.toString()}"/>
	${items.join("")}
	</channel>`;
	const collapsedChannel = collapseWhitespace(channel);
	return `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:psc="http://podlove.org/simple-chapters" xmlns:podcast="https://podcastindex.org/namespace/1.0" version="2.0">${collapsedChannel}</rss>`;
}

function itemRss(pi: PodcastItem): string {
	const xml = `<item>
			<title>${cdata(pi.title)}</title>
			<description>${cdata(pi.description)}</description>
			<guid isPermaLink="false">${pi.guid}</guid>
			<pubDate>${pi.pubDate.toUTCString()}</pubDate>
			<enclosure url="${pi.url}" length="${pi.length}" type="audio/mpeg"/>
			<itunes:summary>${cdata(pi.description)}</itunes:summary>
			<itunes:explicit>false</itunes:explicit>
			<itunes:image href="${pi.image}"/>
	</item>`;
	return collapseWhitespace(xml);
}

const xmlNlRe = /\n\s+/g;
function collapseWhitespace(xml: string): string {
	return xml.replaceAll(xmlNlRe, "");
}

// TODO: we should only use this if it's necessary, calling it "escape" or something like that
function cdata(text: string) {
	return `<![CDATA[${text}]]>`;
}
