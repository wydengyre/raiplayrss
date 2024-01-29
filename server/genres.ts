import { z } from "zod";
import { FetchWithErr } from "../rai/fetch.js";

export { Conf, genresHtml };

const cardSchema = z.object({
	title: z.string(),
	weblink: z.string(),
	path_id: z.string(),
});

const schema = z.object({
	block: z.object({
		cards: z.array(cardSchema),
	}),
});

type Conf = {
	raiBaseUrl: URL;
	baseUrl: URL;
	fetchWithErr: FetchWithErr;
};

async function genresHtml(c: Conf): Promise<string> {
	const json = await fetchGenres(c);
	return renderGenres(c.baseUrl, json);
}

const fetchGenres = async (c: Conf) => {
	const url = new URL("generi.json", c.raiBaseUrl);
	const res = await c.fetchWithErr(url.toString());
	return res.json();
};

async function renderGenres(baseUrl: URL, json: unknown): Promise<string> {
	const parseResult = await schema.safeParseAsync(json);
	if (!parseResult.success) {
		throw new Error(`failed to parse genres JSON: ${parseResult.error}`);
	}
	const gs = parseResult.data;

	return `<div class="genre">
			<h1>Genres</h1>
			<div class="genre-list">
				${gs.block.cards
					.map(
						(card) => `
						<div class="genre-card">
							<a href="${new URL(card.path_id, baseUrl)}">
								<h2>${card.title}</h2>
							</a>
						</div>
					`,
					)
					.join("\n")}
			</div>
		</div>
	`;
}
