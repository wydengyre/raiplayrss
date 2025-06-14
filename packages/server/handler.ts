import { type IRequestStrict, Router, error } from "itty-router";
import { feedHandler } from "./feed-handler.ts";
import type { Config } from "./feed-handler.ts";

export { type Config, mkFetch };

function mkFetch(conf: Config): typeof fetch {
	const fetchFeed = (request: IRequestStrict) =>
		feedHandler(conf, request.params.feed);

	return Router()
		.get("/:feed+.xml", fetchFeed)
		.all("*", notFound)
		.catch((err: unknown) => {
			conf.logger.error(err);
			return error(500, "failed to process request");
		}).fetch;
}

const notFound = () => new Response("Not found.", { status: 404 });
