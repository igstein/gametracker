<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import { supabase } from '$lib/supabase/client';
	import GameCard from '$lib/components/GameCard.svelte';
	import GameDetailModal from '$lib/components/GameDetailModal.svelte';
	import type { Game } from '$lib/types';
	import type { Writable } from 'svelte/store';
	import type { RealtimeChannel } from '@supabase/supabase-js';
	import { isOnline } from '$lib/stores/network';
	import {
		initDB,
		saveGamesToLocal,
		getGamesFromLocal,
		saveGameToLocal,
		deleteGameFromLocal,
		getSyncQueue,
		removeFromSyncQueue
	} from '$lib/services/offline';

	let games: Game[] = [];
	let loading = true;
	let error = '';
	let selectedGame: Game | null = null;
	let showDetailModal = false;
	let realtimeChannel: RealtimeChannel | null = null;
	let realtimeConnected = false;

	const activeFilter = getContext<Writable<string>>('activeFilter');
	const sortBy = getContext<Writable<string>>('sortBy');

	// Helper to calculate target hours
	function getTargetHours(game: Game): number {
		if (game.main_story_hours && game.main_plus_extras_hours) {
			return (game.main_story_hours + game.main_plus_extras_hours) / 2;
		}
		return game.main_story_hours || game.main_plus_extras_hours || 50;
	}

	// Helper to calculate progress percentage
	function getProgress(game: Game): number {
		const target = getTargetHours(game);
		return target > 0 ? (game.played_hours / target) * 100 : 0;
	}

	// Helper to calculate remaining hours
	function getRemainingHours(game: Game): number {
		return Math.max(0, getTargetHours(game) - game.played_hours);
	}

	// Filtered and sorted games
	$: filteredAndSortedGames = (() => {
		// Filter by status
		let filtered = games;
		if ($activeFilter !== 'all') {
			filtered = games.filter((game) => game.status === $activeFilter);
		}

		// Sort
		const sorted = [...filtered];
		switch ($sortBy) {
			case 'name_asc':
				sorted.sort((a, b) => a.title.localeCompare(b.title));
				break;
			case 'name_desc':
				sorted.sort((a, b) => b.title.localeCompare(a.title));
				break;
			case 'progress_asc':
				sorted.sort((a, b) => getProgress(a) - getProgress(b));
				break;
			case 'progress_desc':
				sorted.sort((a, b) => getProgress(b) - getProgress(a));
				break;
			case 'priority':
				const priorityOrder = { must_play: 0, high: 1, medium: 2, low: 3 };
				sorted.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
				break;
			case 'last_played':
				sorted.sort((a, b) => {
					const aDate = a.last_played ? new Date(a.last_played).getTime() : 0;
					const bDate = b.last_played ? new Date(b.last_played).getTime() : 0;
					return bDate - aDate;
				});
				break;
			case 'created_at_desc':
			default:
				// Already sorted by created_at desc from Supabase
				break;
		}

		return sorted;
	})();

	// Next Up: Top 3 games with shortest remaining time from Playing/Backlog
	$: nextUpGames = (() => {
		const playingOrBacklog = games.filter(
			(game) => game.status === 'playing' || game.status === 'backlog'
		);

		return playingOrBacklog
			.map((game) => ({
				game,
				remainingHours: getRemainingHours(game)
			}))
			.sort((a, b) => a.remainingHours - b.remainingHours)
			.slice(0, 3)
			.map((item) => item.game);
	})();

	async function loadGames() {
		loading = true;
		error = '';
		try {
			if ($isOnline) {
				// Online: load from Supabase and cache locally
				const { data: gamesData, error: loadError } = await supabase
					.from('games')
					.select('*')
					.order('created_at', { ascending: false });

				if (loadError) {
					console.error('Error loading games:', loadError);
					error = loadError.message;
					throw loadError;
				}

				games = gamesData || [];

				// Cache in IndexedDB
				await saveGamesToLocal(games);
			} else {
				// Offline: load from IndexedDB
				console.log('[Offline] Loading games from local cache');
				games = await getGamesFromLocal();
			}
		} catch (e) {
			console.error('Error loading games:', e);
			error = e instanceof Error ? e.message : 'Failed to load games';

			// Try loading from cache as fallback
			try {
				games = await getGamesFromLocal();
				error = 'Loaded from offline cache';
			} catch {
				games = [];
			}
		} finally {
			loading = false;
		}
	}

	async function processSyncQueue() {
		if (!$isOnline) return;

		try {
			const queue = await getSyncQueue();
			console.log(`[Sync] Processing ${queue.length} queued operations`);

			for (const item of queue) {
				try {
					if (item.table === 'games') {
						if (item.operation === 'insert') {
							await supabase.from('games').insert(item.data);
						} else if (item.operation === 'update') {
							await supabase.from('games').update(item.data).eq('id', item.data.id);
						} else if (item.operation === 'delete') {
							await supabase.from('games').delete().eq('id', item.data.id);
						}
					} else if (item.table === 'game_notes') {
						if (item.operation === 'insert') {
							await supabase.from('game_notes').insert(item.data);
						} else if (item.operation === 'update') {
							await supabase.from('game_notes').update(item.data).eq('id', item.data.id);
						} else if (item.operation === 'delete') {
							await supabase.from('game_notes').delete().eq('id', item.data.id);
						}
					}

					// Remove from queue after successful sync
					await removeFromSyncQueue(item.id);
					console.log('[Sync] Synced:', item);
				} catch (e) {
					console.error('[Sync] Failed to sync item:', item, e);
					// Keep in queue for retry
				}
			}

			// Reload data after sync
			await loadGames();
		} catch (e) {
			console.error('[Sync] Failed to process queue:', e);
		}
	}

	// Watch for online/offline changes
	$: if ($isOnline) {
		processSyncQueue();
	}

	function openGameDetail(game: Game) {
		selectedGame = game;
		showDetailModal = true;
	}

	function closeGameDetail() {
		showDetailModal = false;
		selectedGame = null;
	}

	function handleGameUpdated() {
		loadGames();
	}

	function setupRealtimeSubscription() {
		// Create a channel for games table
		realtimeChannel = supabase
			.channel('games-changes')
			.on(
				'postgres_changes',
				{
					event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
					schema: 'public',
					table: 'games'
				},
				(payload) => {
					console.log('Realtime update:', payload);

					if (payload.eventType === 'INSERT') {
						// New game added from another device
						const newGame = payload.new as Game;
						games = [newGame, ...games];
					} else if (payload.eventType === 'UPDATE') {
						// Game updated from another device
						const updatedGame = payload.new as Game;
						games = games.map((g) => (g.id === updatedGame.id ? updatedGame : g));
						// Update selected game if it's open
						if (selectedGame && selectedGame.id === updatedGame.id) {
							selectedGame = updatedGame;
						}
					} else if (payload.eventType === 'DELETE') {
						// Game deleted from another device
						const deletedGame = payload.old as Game;
						games = games.filter((g) => g.id !== deletedGame.id);
						// Close detail modal if deleted game is open
						if (selectedGame && selectedGame.id === deletedGame.id) {
							closeGameDetail();
						}
					}
				}
			)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') {
					console.log('Realtime connected');
					realtimeConnected = true;
				} else if (status === 'CLOSED') {
					console.log('Realtime disconnected');
					realtimeConnected = false;
				}
			});
	}

	onMount(async () => {
		// Initialize IndexedDB
		await initDB();

		loadGames();
		setupRealtimeSubscription();

		// Process any pending sync queue items
		if ($isOnline) {
			processSyncQueue();
		}

		// Register callback for when games are added
		const registerCallback = getContext<(callback: () => void) => void>(
			'registerGameAddedCallback'
		);
		if (registerCallback) {
			registerCallback(loadGames);
		}
	});

	onDestroy(() => {
		// Clean up Realtime subscription
		if (realtimeChannel) {
			supabase.removeChannel(realtimeChannel);
		}
	});
</script>

<div class="p-8">
	<!-- Realtime Connection Status -->
	{#if realtimeConnected}
		<div
			class="fixed bottom-4 right-4 bg-green-900/80 border border-green-700 text-green-200 px-3 py-2 rounded-lg text-xs flex items-center gap-2 backdrop-blur-sm"
		>
			<span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
			Live sync active
		</div>
	{/if}

	{#if !loading && nextUpGames.length > 0}
		<div class="mb-8">
			<h2 class="text-xl font-bold text-white mb-4">🎯 Next Up</h2>
			<p class="text-gray-400 text-sm mb-4">
				Games with the shortest remaining time — finish these first!
			</p>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				{#each nextUpGames as game (game.id)}
					<button
						on:click={() => openGameDetail(game)}
						class="flex items-center gap-4 p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-blue-500 transition-colors text-left"
					>
						{#if game.cover_image_url}
							<img
								src={game.cover_image_url}
								alt={game.title}
								class="w-16 h-20 object-cover rounded"
							/>
						{:else}
							<div class="w-16 h-20 bg-gray-700 rounded flex items-center justify-center">
								<span class="text-3xl">🎮</span>
							</div>
						{/if}
						<div class="flex-1 min-w-0">
							<h3 class="text-white font-medium truncate">{game.title}</h3>
							<p class="text-gray-400 text-sm">
								{getRemainingHours(game).toFixed(1)}h remaining
							</p>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<div class="mb-8 flex justify-between items-center">
		<div>
			<h2 class="text-2xl font-bold text-white mb-2">Your Games</h2>
			<p class="text-gray-400">Track your progress and finish what you started</p>
		</div>
		<div class="flex items-center gap-2">
			<label for="sort-select" class="text-gray-400 text-sm">Sort by:</label>
			<select
				id="sort-select"
				bind:value={$sortBy}
				class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
			>
				<option value="created_at_desc">Recently Added</option>
				<option value="name_asc">Name (A-Z)</option>
				<option value="name_desc">Name (Z-A)</option>
				<option value="progress_asc">Progress (Low to High)</option>
				<option value="progress_desc">Progress (High to Low)</option>
				<option value="priority">Priority</option>
				<option value="last_played">Last Played</option>
			</select>
		</div>
	</div>

	{#if error}
		<div class="text-center py-20">
			<div class="bg-red-900/20 border border-red-900 rounded-lg p-6 max-w-lg mx-auto">
				<p class="text-red-400 font-medium mb-2">Error loading games</p>
				<p class="text-red-300 text-sm">{error}</p>
				<button
					on:click={loadGames}
					class="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
				>
					Retry
				</button>
			</div>
		</div>
	{:else if loading}
		<div class="text-center py-20 text-gray-500">
			<p class="text-lg">Loading games...</p>
		</div>
	{:else if filteredAndSortedGames.length > 0}
		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
			{#each filteredAndSortedGames as game (game.id)}
				<GameCard {game} onClick={() => openGameDetail(game)} />
			{/each}
		</div>
	{:else if games.length > 0}
		<div class="text-center py-20 text-gray-500">
			<p class="text-lg">No games match the current filter.</p>
		</div>
	{:else}
		<div class="text-center py-20 text-gray-500">
			<p class="text-lg">No games yet. Click "Add Game" to get started!</p>
		</div>
	{/if}
</div>

<GameDetailModal
	game={selectedGame}
	open={showDetailModal}
	onClose={closeGameDetail}
	onGameUpdated={handleGameUpdated}
/>
