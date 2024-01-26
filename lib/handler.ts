import { Router, createResponse, error, html, text } from "itty-router";
import { feedHandler } from "./feed-handler.js";
import { indexHandler } from "./index-handler.js";
import { Logger } from "./logger.js";

export type FetchHandlerConfig = {
	englishIndexHtml: string;
	italianIndexHtml: string;
	baseUrl: URL;
	raiBaseUrl: URL;
	poolSize: number;
	fetch: typeof fetch;
	logger: Logger;
};

type FetchHandler = (req: Request) => Promise<Response>;
export function mkFetchHandler(conf: FetchHandlerConfig): FetchHandler {
	const fetchIndex = (request: Request) => indexHandler(conf, request);
	const fetchFeed = (request: Request) => feedHandler(conf, request);

	const router = Router()
		.get("/", fetchIndex)
		.get("/programmi/:feed.xml", fetchFeed)
		.all("*", notFound);

	return (request: Request) =>
		router.handle(request).catch((err) => {
			conf.logger.error(err);
			return error(500, "failed to process request");
		});
}

const notFound = () => new Response("Not found.", { status: 404 });
