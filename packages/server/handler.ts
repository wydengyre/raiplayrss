import { mkFetchWithErr } from "@raiplayrss/rai/fetch.js";
import { relink } from "@raiplayrss/rai/relinker.js";
import { IRequestStrict, Router, error, status } from "itty-router";
import { feedHandler } from "./feed-handler.js";
import { Logger } from "./logger.js";

export { Config, FetchHandler, mkFetchHandler };

type Config = {
	raiBaseUrl: URL;
	fetch: typeof fetch;
	logger: Logger;
};

type FetchHandler = (req: Request) => Promise<Response>;
function mkFetchHandler(conf: Config): FetchHandler {
	const fetchWithErr = mkFetchWithErr(conf.fetch);

	const fetchFeedConf = {
		raiBaseUrl: conf.raiBaseUrl,
		fetchWithErr,
		logger: conf.logger,
	};
	const fetchFeed = (req: Request) => feedHandler(fetchFeedConf, req);

	const relinkHandler = async (req: IRequestStrict) => {
		const { link } = req.params;
		const linkUrl = new URL(`https://${link}${new URL(req.url).search}`);
		const relinkUrl = await relink(fetchWithErr, linkUrl);
		return status(302, { headers: { Location: relinkUrl.href } });
	};

	const router = Router()
		.get("/programmi/:feed.xml", fetchFeed)
		.get("/relinker/:link+", relinkHandler)
		.all("*", notFound);

	return (request: Request) =>
		router.handle(request).catch((err) => {
			conf.logger.error(err);
			return error(500, "failed to process request");
		});
}

const notFound = () => new Response("Not found.", { status: 404 });
