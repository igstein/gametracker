import type { SupabaseClient } from '@supabase/supabase-js';
import type { HLTBSearchResult } from '$lib/types';

// Client-side call to our HLTB search API route (which needs the user's session token)
export async function searchHLTB(supabase: SupabaseClient, query: string): Promise<HLTBSearchResult[]> {
	const {
		data: { session }
	} = await supabase.auth.getSession();

	const response = await fetch('/api/hltb/search', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${session?.access_token ?? ''}`
		},
		body: JSON.stringify({ query: query.trim() })
	});

	const data = await response.json();

	if (!response.ok) {
		throw new Error(data.error || 'Search failed');
	}

	return data.results || [];
}
