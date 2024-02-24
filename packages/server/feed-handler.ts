import { feedToRss } from "@raiplayrss/rai/feed.js";
import { FetchWithErr, NotOk } from "@raiplayrss/rai/fetch.js";
import { createResponse } from "itty-router";
import { Logger } from "./logger.js";

export { Config, feedHandler };

type Config = {
	raiBaseUrl: URL;
	fetchWithErr: FetchWithErr;
	logger: Logger;
};
async function feedHandler(conf: Config, request: Request): Promise<Response> {
	const requestUrl = new URL(request.url);
	const localBaseUrl = new URL(requestUrl.origin);
	const relinkerUrl = new URL("/relinker/", localBaseUrl);
	const xmlPath = requestUrl.pathname;
	const jsonPath = xmlPath.replace(/\.xml$/, ".json");
	const conversionConf = { ...conf, relinkerUrl };

	let feedXml: string;
	try {
		feedXml = await feedToRss(conversionConf, jsonPath);
	} catch (e) {
		conf.logger.error("error converting feed", jsonPath, e);
		const contentType = "application/xml";
		const headers = new Headers({ "Content-Type": contentType });
		let status = 500;
		let body = "<error><code>500</code><message>server error</message></error>";
		if (e instanceof NotOk && e.status === 404) {
			status = e.status;
			body = "<error><code>404</code><message>not found</message></error>";
		}
		return new Response(body, { status, headers });
	}
	const rss = createResponse("application/rss+xml");
	return rss(feedXml, { headers: { "Content-Language": "it" } });
}
