export class NotFoundError extends Error {
	constructor(url: URL, context: string) {
		super(`Not found (${context}): ${url}`);
		this.name = "NotFoundError";
	}
}
