import { html } from "itty-router";

type Config = {
	englishIndexHtml: string;
	italianIndexHtml: string;
};
export function indexHandler(conf: Config, request: Request): Response {
	const wantsItalian = request.headers.get("accept-language")?.startsWith("it");
	return wantsItalian
		? html(conf.italianIndexHtml, { headers: { "Content-Language": "it" } })
		: html(conf.englishIndexHtml, { headers: { "Content-Language": "en" } });
}
