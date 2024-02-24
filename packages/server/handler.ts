import { mkFetchWithErr } from "@raiplayrss/rai/fetch.js";
import { Router, error, html } from "itty-router";
import { feedHandler } from "./feed-handler.js";
import { Logger } from "./logger.js";

export { Config, FetchHandler, mkFetchHandler };

type Config = {
	raiBaseUrl: URL;
	poolSize: number;
	fetch: typeof fetch;
	logger: Logger;
};

type FetchHandler = (req: Request) => Promise<Response>;
function mkFetchHandler(conf: Config): FetchHandler {
	const fetchWithErr = mkFetchWithErr(conf.fetch);

	const fetchFeedConf = {
		raiBaseUrl: conf.raiBaseUrl,
		poolSize: conf.poolSize,
		fetchWithErr,
		logger: conf.logger,
	};
	const fetchFeed = (request: Request) => feedHandler(fetchFeedConf, request);

	const router = Router()
		.get("/programmi/:feed.xml", fetchFeed)
		.all("*", notFound);

	return (request: Request) =>
		router.handle(request).catch((err) => {
			conf.logger.error(err);
			return error(500, "failed to process request");
		});
}

const notFound = () => new Response("Not found.", { status: 404 });
