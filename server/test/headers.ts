import { strict as assert } from "node:assert";

export { assertItalian };

function assertItalian({
	headers,
}: { headers: { readonly get: (name: string) => string | null } }) {
	assert.strictEqual(headers.get("Content-Language"), "it");
}
