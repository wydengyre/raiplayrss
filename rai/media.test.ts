import { strict as assert } from "node:assert";
import test from "node:test";
import { FetchWithErr, OkResponse } from "./fetch.js";
import { mkFetchInfo } from "./media.js";

test("media", (t) => {
	return t.test(fetchInfoSuccess);
});

async function fetchInfoSuccess() {
	const url =
		"https://mediapolisvod.rai.it/relinker/relinkerServlet.htm?cont=PE3wc6etKfssSlashNKfaoXssSlashpWcgeeqqEEqualeeqqEEqual";
	const mediaUrl = new URL("https://test.dev/foo.mp3");
	const fetch: FetchWithErr = async () =>
		({
			url: mediaUrl.toString(),
			status: 200,
			headers: new Headers({
				"content-type": "audio/mpeg",
				"content-length": "123456789",
			}),
		}) as OkResponse;
	const fetchInfo = mkFetchInfo(fetch);

	const info = await fetchInfo(url);
	assert.deepStrictEqual(info, {
		url: mediaUrl,
		size: 123456789,
	});
}
