import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { LayoutLoad } from './$types';

export const ssr = false;

let supabase: ReturnType<typeof createClient>;

function getSupabase() {
	if (!supabase) {
		supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
	}
	return supabase;
}

export const load: LayoutLoad = async ({ depends }) => {
	depends('supabase:auth');

	const supabase = getSupabase();

	try {
		const [
			{ data: { session } },
			{ data: { user } }
		] = await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

		return { supabase, session, user, supabaseError: null as string | null };
	} catch (e) {
		console.error('Failed to reach Supabase:', e);
		const message = e instanceof Error ? e.message : 'Unknown error';
		return {
			supabase,
			session: null,
			user: null,
			supabaseError: message
		};
	}
};
