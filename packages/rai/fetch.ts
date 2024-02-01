export { FetchWithErr, NotOk, OkResponse, mkFetchWithErr };

type FetchWithErr = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<OkResponse>;

type OkResponse = Response & { ok: true };

/**
 * Returns a fetch function that errors on a non-ok response
 * @param fetchFn - The underlying fetch function to use
 * @returns A fetch function that throws an error for non-ok responses
 */
const mkFetchWithErr =
	(fetchFn: typeof fetch): FetchWithErr =>
	async (input, init) => {
		const res = await fetchFn(input, init);
		if (!isOk(res)) {
			// maybe we should use the url from the response?
			const url = new URL(input.toString());
			throw new NotOk(url, res.status, res.statusText);
		}
		return res;
	};

/**
 * Error class for non-ok responses
 */
class NotOk extends Error {
	readonly url: URL;
	readonly status: number;
	readonly statusText: string;

	/**
	 * @param url - The URL that resulted in a non-ok response
	 * @param status - The status code of the non-ok response
	 * @param statusText - The status text of the non-ok response
	 */
	constructor(url: URL, status: number, statusText: string) {
		super(`Not ok: ${status} ${statusText} (${url})`);
		this.name = "NotOkError";
		this.url = url;
		this.status = status;
		this.statusText = statusText;
	}
}

function isOk(res: Response): res is OkResponse {
	return res.ok;
}
