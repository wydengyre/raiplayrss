import { writeFile } from "node:fs/promises";
import { getPodcastFromFeed } from "@podverse/podcast-feed-parser";
import { type RssConvertConf, feedToRss } from "@raiplayrss/rai/feed.js";

const feedArg = process.argv.at(-1);
if (feedArg === undefined) {
	console.error("missing feed URL");
	process.exit(1);
}
const feedUrl = new URL(feedArg);
console.log("loading feed at URL", feedUrl.href);

const feedConf: RssConvertConf = {
	raiBaseUrl: feedUrl,
	poolSize: 1,
	fetch,
	logger: {
		info: console.info,
	},
};
const feedRss = await feedToRss(feedConf, "");
console.debug("generated feed", feedRss);
const podcast = getPodcastFromFeed(feedRss) as {
	episodes: { title: string; enclosure: { url: string } }[];
};
const episodes = podcast.episodes.map(
	(e) => [e.title, new URL(e.enclosure.url)] as const,
);

console.log("got feed, downloading episodes");
for (const [title, url] of episodes) {
	const destFileName = `${title.trim()}.${url.pathname.split(".").at(-1)}`;
	console.log(`downloading ${url} to ${destFileName}`);
	const res = await fetch(url);
	if (!res.ok) {
		console.error(`failed to download ${url}`);
		continue;
	}
	const file = await res.arrayBuffer();
	await writeFile(destFileName, new DataView(file));
}
console.log("done");
