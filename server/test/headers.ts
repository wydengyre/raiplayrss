import { strict as assert } from "node:assert";

export { assertItalian };
function assertItalian(response: Response) {
	assert.strictEqual(response.headers.get("Content-Language"), "it");
}
