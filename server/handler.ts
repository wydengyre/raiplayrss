import { Router, createResponse, error, html, text } from "itty-router";
import { mkFetchWithErr } from "../rai/fetch.js";
import { genresHtml } from "../rai/genres.js";
import { feedHandler } from "./feed-handler.js";
import { Logger } from "./logger.js";

export { Config, FetchHandler, mkFetchHandler };

type Config = {
	baseUrl: URL;
	raiBaseUrl: URL;
	poolSize: number;
	fetch: typeof fetch;
	logger: Logger;
};

type FetchHandler = (req: Request) => Promise<Response>;
function mkFetchHandler(conf: Config): FetchHandler {
	const fetchWithErr = mkFetchWithErr(conf.fetch);

	const fetchGenresConf = {
		baseUrl: conf.baseUrl,
		raiBaseUrl: conf.raiBaseUrl,
		fetchWithErr,
		logger: conf.logger,
	};
	const fetchGenres = async () => {
		const gh = await genresHtml(fetchGenresConf);
		return html(gh, { headers: { "Content-Language": "it" } });
	};

	const fetchFeedConf = {
		baseUrl: conf.baseUrl,
		raiBaseUrl: conf.raiBaseUrl,
		poolSize: conf.poolSize,
		fetchWithErr,
		logger: conf.logger,
	};
	const fetchFeed = (request: Request) => feedHandler(fetchFeedConf, request);

	const router = Router()
		.get("/", fetchGenres)
		.get("/programmi/:feed.xml", fetchFeed)
		.all("*", notFound);

	return (request: Request) =>
		router.handle(request).catch((err) => {
			conf.logger.error(err);
			return error(500, "failed to process request");
		});
}

const notFound = () => new Response("Not found.", { status: 404 });
