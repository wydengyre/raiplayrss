import { strict as assert } from "node:assert";
import test from "node:test";
import { json } from "itty-router";
import { NotFoundError } from "./error.js";
import { genresHtml } from "./genres.js";
import genresJson from "./test/generi.json" with { type: "json" };

test("genresHtml", async () => {
	const fetchFn: typeof fetch = async (input) => {
		assert.strictEqual(input.toString(), "https://rai.dev/generi.json");
		return json(genresJson);
	};
	const conf = confWithFetch(fetchFn);

	// just making sure this runs without error
	const _html = await genresHtml(conf);
});

test("genresHtml 404", async () => {
	const fetchFn: typeof fetch = async (input) => {
		assert.strictEqual(input.toString(), "https://rai.dev/generi.json");
		return new Response("Not found", { status: 404 });
	};
	const conf = confWithFetch(fetchFn);

	const expectedErr = new NotFoundError(new URL("https://rai.dev/generi.json"));
	const p = genresHtml(conf);
	await assert.rejects(p, expectedErr);
});

test("genresHtml 500", async () => {
	const fetchFn: typeof fetch = async (input) => {
		assert.strictEqual(input.toString(), "https://rai.dev/generi.json");
		return new Response("Internal Server Error", { status: 500 });
	};
	const conf = confWithFetch(fetchFn);

	const expectedErr = new Error(
		"Failed to fetch https://rai.dev/generi.json 500",
	);
	const p = genresHtml(conf);
	await assert.rejects(p, expectedErr);
});

const confWithFetch = (fetchFn: typeof fetch) => ({
	baseUrl: new URL("https://test.dev/"),
	raiBaseUrl: new URL("https://rai.dev/"),
	genresRel: "generi.json",
	fetch: fetchFn,
});
