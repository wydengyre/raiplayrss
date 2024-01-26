import { Router, createResponse, error, html, text } from "itty-router";
import { NotFoundError, convertFeed } from "./feed.js";
import { logger } from "./logger.js";

// TODO: add logging
export type FetchHandlerConfig = {
	englishIndexHtml: string;
	italianIndexHtml: string;
	baseUrl: URL;
	raiBaseUrl: URL;
	poolSize: number;
	fetch: typeof fetch;
};

type FetchHandler = (req: Request) => Promise<Response>;
export function mkFetchHandler(conf: FetchHandlerConfig): FetchHandler {
	const fetchIndex = (request: Request) => index(conf, request);
	const fetchFeed = (request: Request) => feed(conf, request);

	const router = Router()
		.get("/", fetchIndex)
		.get("/programmi/:feed.xml", fetchFeed)
		.all("*", notFound);

	return (request: Request) =>
		router.handle(request).catch((err) => {
			logger.error(err);
			return error(500, "failed to process request");
		});
}

type IndexConfig = {
	englishIndexHtml: string;
	italianIndexHtml: string;
};
function index(conf: IndexConfig, request: Request): Response {
	const wantsItalian = request.headers.get("accept-language")?.startsWith("it");
	return wantsItalian
		? html(conf.italianIndexHtml, { headers: { "Content-Language": "it" } })
		: html(conf.englishIndexHtml, { headers: { "Content-Language": "en" } });
}

type FeedConfig = {
	baseUrl: URL;
	raiBaseUrl: URL;
	poolSize: number;
	fetch: typeof fetch;
};
async function feed(conf: FeedConfig, request: Request): Promise<Response> {
	const requestUrl = new URL(request.url);
	const xmlPath = requestUrl.pathname;
	const jsonPath = xmlPath.replace(/\.xml$/, ".json");

	let feedXml: string;
	try {
		feedXml = await convertFeed(conf, jsonPath);
	} catch (e) {
		const headers = new Headers({ "Content-Type": "application/xml" });
		let status = 500;
		let body = "<error><code>500</code><message>server error</message></error>";
		if (e instanceof NotFoundError) {
			logger.error("not found", e);
			status = 404;
			body = "<error><code>404</code><message>Not Found</message></error>";
		} else {
			logger.error("error converting feed", jsonPath, e);
		}
		return new Response(body, { status, headers });
	}
	const rss = createResponse("application/rss+xml");
	return rss(feedXml);
}

const notFound = () => new Response("Not found.", { status: 404 });
