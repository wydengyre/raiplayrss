import { error, json } from "itty-router";
import genresJson from "./generi.json";
import feedJson from "./lastoriaingiallo.json";

export const raiBaseUrl = new URL("https://rai.dev/");
const mediaBaseUrl = new URL("https://media.dev/");
export const fetchMock: typeof fetch = async (input, init) => {
	const requestUrlStr = input.toString();
	const { protocol, hostname, pathname, search } = new URL(requestUrlStr);

	if (!(protocol === raiBaseUrl.protocol && hostname === raiBaseUrl.hostname)) {
		throw new Error(`unexpected request to ${requestUrlStr}`);
	}

	if (pathname === "/generi.json") {
		return json(genresJson);
	}

	if (pathname === "/programmi/lastoriaingiallo.json") {
		return json(feedJson);
	}
	if (pathname === "/programmi/500.json") {
		return error(500, "internal server error");
	}
	if (pathname === "/programmi/corrupt.json") {
		return json({ foo: "bar" });
	}

	const relinkerRel = "/relinker/relinkerServlet.htm";
	const relinkerSearchStart = "?cont=";
	if (
		init?.method === "HEAD" &&
		pathname === relinkerRel &&
		search.startsWith(relinkerSearchStart)
	) {
		const urlStart = requestUrlStr.replace(
			new URL(`${relinkerRel}${relinkerSearchStart}`, raiBaseUrl).toString(),
			mediaBaseUrl.toString(),
		);
		const url = `${urlStart}.mp3`;
		return {
			url: url,
			headers: new Headers({
				"Content-Type": "audio/mpeg",
				"Content-Length": "123456789",
			}),
		} as Response;
	}

	return error(404, "not found");
};
