import { json } from '@sveltejs/kit';
import { searchGames } from '$lib/services/hltb';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { query } = body;

		if (!query || typeof query !== 'string') {
			return json({ error: 'Query is required' }, { status: 400 });
		}

		const results = await searchGames(query);

		return json({ results });
	} catch (error) {
		console.error('HLTB API error:', error);
		return json(
			{
				error:
					error instanceof Error
						? error.message
						: 'Failed to search games. Please try manual entry.'
			},
			{ status: 500 }
		);
	}
};
