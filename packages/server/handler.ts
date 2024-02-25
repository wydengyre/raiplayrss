import { Router, error } from "itty-router";
import { feedHandler } from "./feed-handler.js";
import type { Config } from "./feed-handler.js";

export { Config, FetchHandler, mkFetchHandler };

type FetchHandler = (req: Request) => Promise<Response>;
function mkFetchHandler(conf: Config): FetchHandler {
	const fetchFeed = (request: Request) => feedHandler(conf, request);

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
