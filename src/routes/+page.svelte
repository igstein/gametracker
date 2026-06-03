<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import GameCard from '$lib/components/GameCard.svelte';
	import WishlistCard from '$lib/components/WishlistCard.svelte';
	import GameDetailModal from '$lib/components/GameDetailModal.svelte';
	import FocusSection from '$lib/components/FocusSection.svelte';
	import NextUpSection from '$lib/components/NextUpSection.svelte';
	import type { Game } from '$lib/types';
	import { getTargetHours } from '$lib/utils';
	import { PRIORITY_ORDER } from '$lib/constants';
	import type { Writable } from 'svelte/store';
	import type { RealtimeChannel } from '@supabase/supabase-js';
	import { isOnline } from '$lib/stores/network';
	import { allGames } from '$lib/stores/games';
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
	let cacheNotice = '';
	let selectedGame: Game | null = null;
	let showDetailModal = false;
	let realtimeChannel: RealtimeChannel | null = null;
	let realtimeConnected = false;

	$: supabase = $page.data.supabase;

	const activeFilter = getContext<Writable<string>>('activeFilter');
	const activePriorityFilter = getContext<Writable<string>>('activePriorityFilter');
	const activePlatformFilter = getContext<Writable<string>>('activePlatformFilter');
	const availablePlatformsStore = getContext<Writable<string[]>>('availablePlatforms');
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

	// Sync games into shared store so AddGameModal can check duplicates
	$: allGames.set(games);

	// Whether the wishlist view is active
	$: isWishlistView = $activeFilter === 'wishlist';

	// Library games (exclude wishlist)
	$: libraryGames = games.filter((g) => g.status !== 'wishlist');

	// Wishlist games
	$: wishlistGames = games.filter((g) => g.status === 'wishlist');

	// Filtered and sorted games (library only, excludes wishlist)
	$: filteredAndSortedGames = (() => {
		// Filter by status
		let filtered = libraryGames;
		if ($activeFilter !== 'all' && $activeFilter !== 'wishlist') {
			filtered = libraryGames.filter((game) => game.status === $activeFilter);
		}

		// Filter by priority
		if ($activePriorityFilter !== 'all') {
			filtered = filtered.filter((game) => game.priority === $activePriorityFilter);
		}

		// Filter by platform
		if ($activePlatformFilter !== 'all') {
			filtered = filtered.filter((game) => game.platform?.includes($activePlatformFilter));
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
				sorted.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
				break;
			case 'last_played':
				sorted.sort((a, b) => {
					const aDate = a.last_played ? new Date(a.last_played).getTime() : 0;
					const bDate = b.last_played ? new Date(b.last_played).getTime() : 0;
					return bDate - aDate;
				});
				break;
			case 'remaining_asc':
				sorted.sort((a, b) => getRemainingHours(a) - getRemainingHours(b));
				break;
			case 'remaining_desc':
				sorted.sort((a, b) => getRemainingHours(b) - getRemainingHours(a));
				break;
			case 'created_at_desc':
			default:
				// Already sorted by created_at desc from Supabase
				break;
		}

		return sorted;
	})();

	// Filtered and sorted wishlist games
	$: filteredAndSortedWishlist = (() => {
		let filtered = wishlistGames;

		// Filter by priority
		if ($activePriorityFilter !== 'all') {
			filtered = filtered.filter((game) => game.priority === $activePriorityFilter);
		}

		// Filter by platform
		if ($activePlatformFilter !== 'all') {
			filtered = filtered.filter((game) => game.platform?.includes($activePlatformFilter));
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
			case 'priority':
				sorted.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
				break;
			case 'main_story_asc':
				sorted.sort((a, b) => (a.main_story_hours ?? 999) - (b.main_story_hours ?? 999));
				break;
			case 'main_story_desc':
				sorted.sort((a, b) => (b.main_story_hours ?? 0) - (a.main_story_hours ?? 0));
				break;
			case 'created_at_desc':
			default:
				break;
		}

		return sorted;
	})();

	// Unique platforms across library games (for quick-select in detail modal and sidebar filter)
	$: availablePlatforms = [...new Set(libraryGames.flatMap((g) => g.platform ?? []))].sort();

	// Unique devices across all games (for quick-select in detail modal)
	$: availableDevices = [...new Set(games.flatMap((g) => g.devices ?? []))].sort();
	$: availablePlatformsStore.set(availablePlatforms);

	// Unique settings across all games
	$: availableSettings = [...new Set(games.flatMap((g) => g.setting ?? []))].sort();

	async function loadGames() {
		loading = true;
		error = '';
		cacheNotice = '';
		try {
			if ($isOnline) {
				const { data: gamesData, error: loadError } = await supabase
					.from('games')
					.select('*')
					.order('created_at', { ascending: false });

				if (loadError) throw loadError;

				games = gamesData || [];
				await saveGamesToLocal(games);
			} else {
				console.log('[Offline] Loading games from local cache');
				games = await getGamesFromLocal();
				cacheNotice = 'Offline — showing cached library';
			}
		} catch (e) {
			console.error('Error loading games:', e);
			try {
				games = await getGamesFromLocal();
				if (games.length > 0) {
					cacheNotice = "Can't reach the server — showing cached library";
				} else {
					error = e instanceof Error ? e.message : 'Failed to load games';
				}
			} catch {
				games = [];
				error = e instanceof Error ? e.message : 'Failed to load games';
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
	{#if cacheNotice}
		<div
			class="mb-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 px-4 py-2 rounded-lg text-sm flex items-center justify-between gap-3"
		>
			<span>{cacheNotice}</span>
			<button
				on:click={loadGames}
				class="text-amber-700 dark:text-amber-300 hover:underline whitespace-nowrap"
			>
				Retry
			</button>
		</div>
	{/if}

	<!-- Realtime Connection Status -->
	{#if realtimeConnected}
		<div
			class="fixed bottom-4 right-4 bg-green-100 dark:bg-green-900/80 border border-green-300 dark:border-green-700 text-green-900 dark:text-green-200 px-3 py-2 rounded-lg text-xs flex items-center gap-2 backdrop-blur-sm"
		>
			<span class="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"></span>
			Live sync active
		</div>
	{/if}

	{#if !loading && !isWishlistView}
		<FocusSection {games} onOpenGame={openGameDetail} />
	{/if}

	{#if !loading && !isWishlistView}
		<NextUpSection games={libraryGames} onOpenGame={openGameDetail} />
	{/if}

	{#if isWishlistView}
		<!-- Wishlist View -->
		<div class="mb-8 flex flex-wrap gap-4 justify-between items-start">
			<div>
				<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">💫 Wishlist</h2>
				<p class="text-gray-600 dark:text-gray-400">Games you want to play in the future</p>
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
					<option value="priority">Priority</option>
					<option value="main_story_asc">Length (Short to Long)</option>
					<option value="main_story_desc">Length (Long to Short)</option>
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
				<p class="text-lg">Loading wishlist...</p>
			</div>
		{:else if filteredAndSortedWishlist.length > 0}
			<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 max-w-[1800px]">
				{#each filteredAndSortedWishlist as game (game.id)}
					<WishlistCard {game} onClick={() => openGameDetail(game)} />
				{/each}
			</div>
		{:else if wishlistGames.length > 0}
			<div class="text-center py-20 text-gray-500 dark:text-gray-500">
				<p class="text-lg">No wishlist games match the current filter.</p>
			</div>
		{:else}
			<div class="text-center py-20 text-gray-500 dark:text-gray-500">
				<p class="text-lg">Your wishlist is empty. Add games with "Add to Wishlist" to start planning!</p>
			</div>
		{/if}
	{:else}
		<!-- Library View -->
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
					<option value="remaining_asc">Remaining Time (Low to High)</option>
					<option value="remaining_desc">Remaining Time (High to Low)</option>
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
		{:else if libraryGames.length > 0}
			<div class="text-center py-20 text-gray-500 dark:text-gray-500">
				<p class="text-lg">No games match the current filter.</p>
			</div>
		{:else}
			<div class="text-center py-20 text-gray-500 dark:text-gray-500">
				<p class="text-lg">No games yet. Click "Add Game" to get started!</p>
			</div>
		{/if}
	{/if}
</div>

<GameDetailModal
	game={selectedGame}
	open={showDetailModal}
	onClose={closeGameDetail}
	onGameUpdated={handleGameUpdated}
	onGameDeleted={handleGameUpdated}
	{availablePlatforms}
	{availableDevices}
	{availableSettings}
	playingGames={libraryGames.filter((g) => g.status === 'playing')}
/>
