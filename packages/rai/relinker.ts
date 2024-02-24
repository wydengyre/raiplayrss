import { FetchWithErr } from "./fetch.js";

export { relink };

async function relink(fetch: FetchWithErr, url: URL): Promise<URL> {
	const resp= await fetch(url, { method: "HEAD" });
	return new URL(resp.url);
}
