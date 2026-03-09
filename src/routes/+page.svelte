<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import GameCard from '$lib/components/GameCard.svelte';
	import GameDetailModal from '$lib/components/GameDetailModal.svelte';
	import type { Game } from '$lib/types';
	import { getTargetHours } from '$lib/utils';
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

	$: supabase = $page.data.supabase;

	const activeFilter = getContext<Writable<string>>('activeFilter');
	const sortBy = getContext<Writable<string>>('sortBy');
	const registerCallback = getContext<(callback: () => void) => void>('registerGameAddedCallback');

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

	// Watch for online/offline changes (browser only)
	$: if (browser && $isOnline) {
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

<div class="p-4 md:p-8 safe-bottom">
	<!-- Realtime Connection Status -->
	{#if realtimeConnected}
		<div
			class="fixed bottom-4 right-4 bg-green-100 dark:bg-green-900/80 border border-green-300 dark:border-green-700 text-green-900 dark:text-green-200 px-3 py-2 rounded-lg text-xs flex items-center gap-2 backdrop-blur-sm"
		>
			<span class="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"></span>
			Live sync active
		</div>
	{/if}

	{#if !loading && nextUpGames.length > 0}
		<div class="mb-8">
			<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-3">🎯 Next Up</h2>
			<div class="flex gap-3 overflow-x-auto pb-1">
				{#each nextUpGames as game (game.id)}
					{@const t = getTargetHours(game)}
					{@const prog = Math.min(100, t > 0 ? (game.played_hours / t) * 100 : 0)}
					{@const progColor = prog < 30 ? 'bg-red-500' : prog < 70 ? 'bg-yellow-500' : 'bg-green-500'}
					{@const priorityConfig = { must_play: { icon: '★', color: 'text-yellow-400' }, high: { icon: '●', color: 'text-gray-400' }, medium: { icon: '●', color: 'text-amber-600' }, low: { icon: '○', color: 'text-gray-600' } }}
					{@const prio = priorityConfig[game.priority]}
					<div
						on:click={() => openGameDetail(game)}
						on:keydown={(e) => e.key === 'Enter' && openGameDetail(game)}
						role="button"
						tabindex="0"
						class="flex-shrink-0 w-28 lg:w-36 xl:w-40 bg-white dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer border relative transition-colors hover:bg-gray-50 dark:hover:bg-gray-750 {game.status === 'finished' ? 'border-green-500' : game.status === 'abandoned' ? 'border-gray-400' : 'border-gray-200 dark:border-gray-700'}"
					>
						{#if game.status === 'finished'}
							<span class="absolute top-1 right-1 z-10 bg-green-600 text-white text-[7px] font-bold uppercase px-1 py-0.5 rounded tracking-wide">✓</span>
						{:else if game.status === 'abandoned'}
							<span class="absolute top-1 right-1 z-10 bg-gray-400 text-white text-[7px] font-bold uppercase px-1 py-0.5 rounded tracking-wide">✗</span>
						{/if}
						<div class="aspect-[2/3] bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
							{#if game.cover_image_url}
								<img
									src={game.cover_image_url}
									alt={game.title}
									class="w-full h-full object-cover"
									style={game.status === 'finished' ? 'filter: brightness(0.5) saturate(0.7);' : game.status === 'abandoned' ? 'filter: brightness(0.35) saturate(0.4);' : ''}
								/>
							{:else}
								<span class="text-2xl">🎮</span>
							{/if}
						</div>
						<div class="p-2">
							<div class="flex items-start justify-between gap-1 mb-1.5">
								<h3 class="font-semibold text-gray-900 dark:text-white text-[10px] line-clamp-2 flex-1">{game.title}</h3>
								<span class="text-xs {prio.color} flex-shrink-0">{prio.icon}</span>
							</div>
							{#if t > 0}
							<div class="space-y-1">
								<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
									<div class="{progColor} h-full transition-all" style="width: {prog}%"></div>
								</div>
								<div class="flex justify-between text-[9px] text-gray-600 dark:text-gray-400">
									<span>{Math.round(game.played_hours * 10) / 10}h / {t.toFixed(0)}h</span>
									<span>{prog.toFixed(0)}%</span>
								</div>
							</div>
							{:else}
							<p class="text-[9px] text-amber-500 dark:text-amber-400">Set target time</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="mb-8 flex flex-wrap gap-4 justify-between items-start">
		<div>
			<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2 capitalize">{$activeFilter === 'all' ? 'All Games' : $activeFilter}</h2>
			<p class="text-gray-600 dark:text-gray-400">Track your progress and finish what you started</p>
		</div>
		<div class="flex items-center gap-2">
			<label for="sort-select" class="text-gray-600 dark:text-gray-400 text-sm">Sort by:</label>
			<select
				id="sort-select"
				bind:value={$sortBy}
				class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
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
			<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-6 max-w-lg mx-auto">
				<p class="text-red-700 dark:text-red-400 font-medium mb-2">Error loading games</p>
				<p class="text-red-600 dark:text-red-300 text-sm">{error}</p>
				<button
					on:click={loadGames}
					class="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
				>
					Retry
				</button>
			</div>
		</div>
	{:else if loading}
		<div class="text-center py-20 text-gray-500 dark:text-gray-500">
			<p class="text-lg">Loading games...</p>
		</div>
	{:else if filteredAndSortedGames.length > 0}
		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 max-w-[1800px]">
			{#each filteredAndSortedGames as game (game.id)}
				<GameCard {game} onClick={() => openGameDetail(game)} />
			{/each}
		</div>
	{:else if games.length > 0}
		<div class="text-center py-20 text-gray-500 dark:text-gray-500">
			<p class="text-lg">No games match the current filter.</p>
		</div>
	{:else}
		<div class="text-center py-20 text-gray-500 dark:text-gray-500">
			<p class="text-lg">No games yet. Click "Add Game" to get started!</p>
		</div>
	{/if}
</div>

<GameDetailModal
	game={selectedGame}
	open={showDetailModal}
	onClose={closeGameDetail}
	onGameUpdated={handleGameUpdated}
	onGameDeleted={handleGameUpdated}
/>
