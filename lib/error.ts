export class NotFoundError extends Error {
	constructor(url: URL) {
		super(`Not found: ${url}`);
		this.name = "NotFoundError";
	}
}
