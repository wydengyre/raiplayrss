import { feedToRss } from "@raiplayrss/rai/feed.js";
import { createResponse } from "itty-router";
import type { Logger } from "./logger.js";
import xmlEscape from "xml-escape";

export { type Config, feedHandler };

type Config = {
	raiBaseUrl: URL;
	poolSize: number;
	fetch: typeof fetch;
	logger: Logger;
};
async function feedHandler(conf: Config, xmlPath: string): Promise<Response> {
	const jsonPath = `${xmlPath}.json`;

	let feedXml: string;
	try {
		feedXml = await feedToRss(conf, jsonPath);
	} catch (e) {
		const errStr = `error converting feed ${jsonPath}: ${e}`;
		conf.logger.error(errStr);
		const contentType = "application/xml";
		const headers = new Headers({ "Content-Type": contentType });
		const status = 500;
		const escapedErrStr = xmlEscape(errStr);
		const body = `<error><code>${status}</code><message>${escapedErrStr}</message></error>`;
		return new Response(body, { status, headers });
	}
	const rss = createResponse("application/rss+xml");
	return rss(feedXml, { headers: { "Content-Language": "it" } });
}
