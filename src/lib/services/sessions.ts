// Play session log: one row per playtime change, with an optional note

import { get } from 'svelte/store';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LatestNote, PlaySession } from '$lib/types';
import { isOnline } from '$lib/stores/network';
import { addToSyncQueue } from '$lib/services/offline';

// Writes go straight to Supabase when online, otherwise into the offline sync queue.
// Ids are generated client-side so queued rows can still be updated or deleted (undo).

export async function insertSession(supabase: SupabaseClient, session: PlaySession): Promise<void> {
	if (get(isOnline)) {
		const { error } = await supabase.from('play_sessions').insert(session);
		if (error) throw error;
	} else {
		await addToSyncQueue({ operation: 'insert', table: 'play_sessions', data: session });
	}
}

export async function updateSession(
	supabase: SupabaseClient,
	id: string,
	changes: Partial<Pick<PlaySession, 'hours' | 'note'>>
): Promise<void> {
	if (get(isOnline)) {
		const { error } = await supabase.from('play_sessions').update(changes).eq('id', id);
		if (error) throw error;
	} else {
		await addToSyncQueue({ operation: 'update', table: 'play_sessions', data: { id, ...changes } });
	}
}

export async function deleteSession(supabase: SupabaseClient, id: string): Promise<void> {
	if (get(isOnline)) {
		const { error } = await supabase.from('play_sessions').delete().eq('id', id);
		if (error) throw error;
	} else {
		await addToSyncQueue({ operation: 'delete', table: 'play_sessions', data: { id } });
	}
}

/** Newest journal entry or session note per game, for the "Where was I?" line on cards */
export async function loadLatestNotes(
	supabase: SupabaseClient,
	gameIds: string[]
): Promise<Record<string, LatestNote>> {
	if (gameIds.length === 0) return {};
	const [notesRes, sessionsRes] = await Promise.all([
		supabase
			.from('game_notes')
			.select('game_id, content, created_at')
			.in('game_id', gameIds)
			.order('created_at', { ascending: false }),
		supabase
			.from('play_sessions')
			.select('game_id, note, played_at')
			.in('game_id', gameIds)
			.not('note', 'is', null)
			.order('played_at', { ascending: false })
	]);
	if (notesRes.error) throw notesRes.error;
	if (sessionsRes.error) throw sessionsRes.error;

	const latest: Record<string, LatestNote> = {};
	const consider = (gameId: string, text: string, at: string) => {
		const current = latest[gameId];
		if (!current || new Date(at) > new Date(current.at)) latest[gameId] = { text, at };
	};
	for (const n of notesRes.data ?? []) consider(n.game_id, n.content, n.created_at);
	for (const s of sessionsRes.data ?? []) consider(s.game_id, s.note, s.played_at);
	return latest;
}
