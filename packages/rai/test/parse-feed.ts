import { getPodcastFromFeed } from "@podverse/podcast-feed-parser";

export function parseFeed(feed: string): object {
	const parsedFeed = JSON.parse(JSON.stringify(getPodcastFromFeed(feed)));
	const { meta, ...rest } = parsedFeed;
	const { lastBuildDate: _lastBuildDate, ...metaRest } = meta;
	return { meta: metaRest, ...rest };
}
