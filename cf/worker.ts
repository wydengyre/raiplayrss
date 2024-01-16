import englishIndexHtml from "../lib/english.html";
import { mkFetchHandler } from "../lib/handler.js";
import italianIndexHtml from "../lib/italian.html";

type Env = {
	BASE_URL: string;
	RAI_BASE_URL: string;
	FETCH_QUEUE_SIZE: string;
};

export default (<ExportedHandler<Env>>{
	fetch: (request, env, _ctx) => {
		const baseUrl = new URL(env.BASE_URL);
		const raiBaseUrl = new URL(env.RAI_BASE_URL);
		const poolSize = parseInt(env.FETCH_QUEUE_SIZE, 10);

		const fetchFn = fetch.bind(globalThis);
		const fetchHandler = mkFetchHandler({
			englishIndexHtml,
			italianIndexHtml,
			baseUrl,
			raiBaseUrl,
			poolSize,
			fetch: fetchFn,
		});
		return fetchHandler(request);
	},
});
