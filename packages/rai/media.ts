export { FetchInfo, MediaInfo, MediaUrl, mkFetchInfo };

type FetchInfo = (url: string) => Promise<MediaInfo>;

type MediaUrl = URL;

type MediaInfo = {
	url: URL;
	size: number;
	type: string;
};

const relinkerRe = /^\?cont=[a-zA-Z0-9]+$/;

const mkFetchInfo =
	(fetch: typeof globalThis.fetch): FetchInfo =>
	async (url) => {
		const mediaUrl = mkMediaUrl(url);
		if (typeof mediaUrl === "string") {
			const err = `Invalid URL (${url}): ${mediaUrl}`;
			throw new Error(err);
		}

		const chromeAgent =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/[latest_version] Safari/537.36";
		const chromeHeadInit: RequestInit = {
			method: "HEAD",
			headers: {
				"User-Agent": chromeAgent,
			},
			redirect: "manual",
		};

		const resp = await fetch(url, chromeHeadInit);
		if (resp.status !== 302)	 {
			throw new Error(`Unexpected status code: ${resp.status}`);
		}

		const location = resp.headers.get("location");
		if (location === null) {
			throw new Error(`Missing location header: ${JSON.stringify(resp.headers)}`);
		}
		const locationUrl = new URL(location);

		const contentLength = resp.headers.get("content-length");
		const length = Number(contentLength);
		if (Number.isNaN(length)) {
			throw new Error(`Invalid content length: ${contentLength}`);
		}

		const type = resp.headers.get("content-type");
		if (type === null) {
			throw new Error("Missing content type");
		}

		return { url: locationUrl, size: length, type };
	};

function mkMediaUrl(urlStr: string): MediaUrl | string {
	let url: URL;
	try {
		url = new URL(urlStr);
	} catch (e) {
		return `Invalid URL: ${urlStr}: ${e}`;
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return `Invalid protocol: ${url.protocol}`;
	}

	if (url.pathname !== "/relinker/relinkerServlet.htm") {
		return `Invalid path: ${url.pathname}`;
	}

	if (!relinkerRe.test(url.search)) {
		return `Invalid search: ${url.search}`;
	}

	return url;
}
