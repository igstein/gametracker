import { writable } from 'svelte/store';
import type { Game } from '$lib/types';

export const allGames = writable<Game[]>([]);
