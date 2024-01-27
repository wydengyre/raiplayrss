import { Router, createResponse, error, html, text } from "itty-router";
import { feedHandler } from "./feed-handler.js";
import { genresHtml } from "./genres.js";
import { Logger } from "./logger.js";

export type FetchHandlerConfig = {
	baseUrl: URL;
	raiBaseUrl: URL;
	poolSize: number;
	fetch: typeof fetch;
	logger: Logger;
};

type FetchHandler = (req: Request) => Promise<Response>;
export function mkFetchHandler(conf: FetchHandlerConfig): FetchHandler {
	const fetchGenres = async () => {
		const gh = await genresHtml(conf);
		return html(gh, { headers: { "Content-Language": "it" } });
	};
	const fetchFeed = (request: Request) => feedHandler(conf, request);

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
