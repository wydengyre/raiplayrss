import { strict as assert } from "node:assert";
import test from "node:test";
import { json } from "itty-router";
import { FetchWithErr, NotOk, OkResponse } from "../rai/fetch.js";
import genresJson from "../rai/test/generi.json" with { type: "json" };
import { genresHtml } from "./genres.js";

test("genres", async (t) => {
	await t.test(genresHtmlSuccess);
	await t.test(genresHtmlNotFound);
	await t.test(genresHtml500);
});

async function genresHtmlSuccess() {
	const fetchWithErr: FetchWithErr = () =>
		Promise.resolve(json(genresJson) as OkResponse);
	const conf = confWithFetch(fetchWithErr);

	await genresHtml(conf);
}

async function genresHtmlNotFound() {
	const url = new URL("https://rai.dev/generi.json");
	const notFound = new NotOk(url, 404, "Not Found");
	const fetchWithErr: FetchWithErr = () => Promise.reject(notFound);
	const conf = confWithFetch(fetchWithErr);

	const p = genresHtml(conf);
	await assert.rejects(p, notFound);
}

async function genresHtml500() {
	const url = new URL("https://rai.dev/generi.json");
	const internalServerErr = new NotOk(url, 500, "Internal Server Error");
	const fetchWithErr: FetchWithErr = () => Promise.reject(internalServerErr);
	const conf = confWithFetch(fetchWithErr);

	const p = genresHtml(conf);
	await assert.rejects(p, internalServerErr);
}

const confWithFetch = (fetchWithErr: FetchWithErr) => ({
	baseUrl: new URL("https://test.dev/"),
	raiBaseUrl: new URL("https://rai.dev/"),
	genresRel: "generi.json",
	fetchWithErr,
});
