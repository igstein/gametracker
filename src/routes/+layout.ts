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

	const {
		data: { session }
	} = await supabase.auth.getSession();

	const {
		data: { user }
	} = await supabase.auth.getUser();

	return { supabase, session, user };
};
