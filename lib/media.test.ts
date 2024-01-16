import { strict as assert } from "assert";
import test from "node:test";
import { Fetcher } from "./media.js";

test("fetchInfo", async () => {
	const url =
		"https://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=PE3wc6etKfssSlashNKfaoXssSlashpWcgeeqqEEqualeeqqEEqual";
	const mediaUrl = new URL("https://test.dev/foo.mp3");
	const f: typeof fetch = async () =>
		({
			url: mediaUrl.toString(),
			status: 200,
			headers: new Headers({
				"content-type": "audio/mpeg",
				"content-length": "123456789",
			}),
		}) as Response;
	const fetcher = new Fetcher(f);
	const info = await fetcher.fetchInfo(url);
	assert.deepStrictEqual(info, {
		url: mediaUrl,
		size: 123456789,
	});
});
