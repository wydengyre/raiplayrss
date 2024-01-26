import { createResponse } from "itty-router";
import { NotFoundError, convertFeed } from "./feed.js";
import { logger } from "./logger.js";

type Config = {
	baseUrl: URL;
	raiBaseUrl: URL;
	poolSize: number;
	fetch: typeof fetch;
};
export async function feedHandler(
	conf: Config,
	request: Request,
): Promise<Response> {
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
