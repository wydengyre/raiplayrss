export { MediaInfo, MediaUrl, fetchInfo };

const chromeAgent =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/[latest_version] Safari/537.36";

type MediaUrl = URL;

type MediaInfo = {
	url: URL;
	size: number;
};

const relinkerRe = /^\?cont=[a-zA-Z0-9]+$/;
async function fetchInfo(
	fetch: typeof globalThis.fetch,
	url: string,
): Promise<MediaInfo> {
	const mediaUrl = mkMediaUrl(url);
	if (typeof mediaUrl === "string") {
		const err = `Invalid URL (${url}): ${mediaUrl}`;
		throw new Error(err);
	}

	const chromeHeadInit: RequestInit = {
		method: "HEAD",
		headers: {
			"User-Agent": chromeAgent,
		},
	};
	const resp = await fetch(url, chromeHeadInit);

	const expectedContentType = "audio/mpeg";
	const contentType = resp.headers.get("content-type");
	if (contentType !== expectedContentType) {
		throw new Error(
			`Invalid content type: ${contentType}, wanted ${expectedContentType}`,
		);
	}

	const contentLength = resp.headers.get("content-length");
	const length = Number(contentLength);
	if (Number.isNaN(length)) {
		throw new Error(`Invalid content length: ${contentLength}`);
	}

	return { url: new URL(resp.url), size: length };
}

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
