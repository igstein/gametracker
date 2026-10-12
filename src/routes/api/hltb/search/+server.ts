import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { searchGames } from '$lib/services/hltb';
import type { RequestHandler } from './$types';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
	auth: { persistSession: false, autoRefreshToken: false }
});

export const POST: RequestHandler = async ({ request }) => {
	// Only logged-in users may search, so the endpoint can't be used as an open HLTB proxy
	const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
	if (!token) {
		return json({ error: 'Not logged in' }, { status: 401 });
	}
	const { data, error: authError } = await supabase.auth.getUser(token);
	if (authError || !data.user) {
		return json({ error: 'Session expired. Please log in again.' }, { status: 401 });
	}

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
