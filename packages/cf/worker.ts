import { mkFetchHandler } from "@raiplayrss/server/handler.js";
import * as logger from "@raiplayrss/server/logger.js";

export default (<ExportedHandler<Env>>{
	fetch: (request, env, _ctx) => {
		const raiBaseUrl = new URL(env.RAI_BASE_URL);
		const poolSize = Number.parseInt(env.FETCH_QUEUE_SIZE, 10);
		const l = logger.atLevelStr(env.LOG_LEVEL);

		const fetchFn = fetch.bind(globalThis);
		const fetchHandler = mkFetchHandler({
			raiBaseUrl,
			poolSize,
			fetch: fetchFn,
			logger: l,
		});
		return fetchHandler(request);
	},
});

type Env = {
	RAI_BASE_URL: string;
	FETCH_QUEUE_SIZE: string;
	LOG_LEVEL: string;
};
