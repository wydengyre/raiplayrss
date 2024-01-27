import { mkFetchHandler } from "../lib/handler.js";
import * as logger from "../lib/logger.js";

type Env = {
	BASE_URL: string;
	RAI_BASE_URL: string;
	FETCH_QUEUE_SIZE: string;
	LOG_LEVEL: string;
};

export default (<ExportedHandler<Env>>{
	fetch: (request, env, _ctx) => {
		const baseUrl = new URL(env.BASE_URL);
		const raiBaseUrl = new URL(env.RAI_BASE_URL);
		const poolSize = parseInt(env.FETCH_QUEUE_SIZE, 10);
		const l = logger.atLevelStr(env.LOG_LEVEL);

		const fetchFn = fetch.bind(globalThis);
		const fetchHandler = mkFetchHandler({
			baseUrl,
			raiBaseUrl,
			poolSize,
			fetch: fetchFn,
			logger: l,
		});
		return fetchHandler(request);
	},
});
