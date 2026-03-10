<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import GameCard from '$lib/components/GameCard.svelte';
	import GameDetailModal from '$lib/components/GameDetailModal.svelte';
	import type { Game } from '$lib/types';
	import { getTargetHours, scoreGame } from '$lib/utils';
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
	let showDebug = false;
	let moodGenre: string | null = null;
	let moodPlatform: string | null = null;
	let showMoodPicker = false;

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

	// Unique platforms across all games (for quick-select in detail modal)
	$: availablePlatforms = [...new Set(games.flatMap((g) => g.platform ?? []))].sort();

	// Mood options derived from games that have data
	$: moodGenreOptions = [...new Set(games.flatMap((g) => g.genre ?? []))].sort();
	$: moodPlatformOptions = availablePlatforms;

	// Next Up: Top 3 games scored by priority, recency, completion, genre diversity and age
	$: nextUpGames = (() => {
		const candidates = games.filter(
			(game) => game.status === 'playing' || game.status === 'backlog'
		);

		// Find genre of most recently played game
		const recentGame = games
			.filter((g) => g.last_played && g.genre?.length)
			.sort((a, b) => new Date(b.last_played ?? '').getTime() - new Date(a.last_played ?? '').getTime())[0];
		const recentGenres = recentGame?.genre ?? [];

		const priorityMap: Record<string, number> = { must_play: 1.7, high: 1.3, medium: 1.0, low: 0.7 };

		return candidates
			.map((game) => {
				const target = getTargetHours(game);
				const rest = Math.max(0, target - game.played_hours);
				const P = priorityMap[game.priority];
				const restFactor = 1 / (rest + 1);
				const daysSince = game.last_played ? (Date.now() - new Date(game.last_played).getTime()) / 86_400_000 : null;
				const recencyFactor = daysSince !== null ? Math.exp(-daysSince / 7) : 1.0;
				const genreFactor = recentGenres.length && game.genre?.length ? (game.genre.some((g) => recentGenres.includes(g)) ? 0.8 : 1.2) : 1.0;
				const backlogDays = game.date_added ? (Date.now() - new Date(game.date_added).getTime()) / 86_400_000 : 0;
				const ageFactor = 1 + Math.tanh(backlogDays / 365) * 0.5;
				const statusFactor = game.status === 'playing' ? 1.5 : 1.0;
				const moodGenreFactor = moodGenre ? (game.genre?.includes(moodGenre) ? 1.3 : 0.9) : 1.0;
				const moodPlatformFactor = moodPlatform ? (game.platform?.includes(moodPlatform) ? 1.25 : 0.9) : 1.0;
				const moodFactor = moodGenreFactor * moodPlatformFactor;
				const score = P * restFactor * recencyFactor * genreFactor * ageFactor * statusFactor * moodFactor;
				return { game, score, debug: { P, restFactor, recencyFactor, genreFactor, ageFactor, statusFactor, moodFactor } };
			})
			.sort((a, b) => b.score - a.score)
			.slice(0, 3);
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

	function loadMood() {
		if (!browser) return;
		const stored = localStorage.getItem('gametracker_mood');
		if (!stored) return;
		try {
			const data = JSON.parse(stored);
			const setAt = new Date(data.setAt);
			const today7am = new Date();
			today7am.setHours(7, 0, 0, 0);
			if (setAt < today7am) {
				localStorage.removeItem('gametracker_mood');
				return;
			}
			moodGenre = data.genre ?? null;
			moodPlatform = data.platform ?? null;
		} catch {
			localStorage.removeItem('gametracker_mood');
		}
	}

	function saveMood() {
		if (!browser) return;
		if (!moodGenre && !moodPlatform) {
			localStorage.removeItem('gametracker_mood');
		} else {
			localStorage.setItem('gametracker_mood', JSON.stringify({
				genre: moodGenre,
				platform: moodPlatform,
				setAt: new Date().toISOString()
			}));
		}
	}

	onMount(async () => {
		// Initialize IndexedDB
		await initDB();

		loadMood();
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
			<div class="flex items-center gap-2 mb-2 flex-wrap">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">🎯 Next Up</h2>
				{#if moodGenre}
					<span class="flex items-center gap-1 px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded-full">
						{moodGenre}
						<button on:click={() => { moodGenre = null; saveMood(); }} class="text-purple-400 hover:text-white leading-none">×</button>
					</span>
				{/if}
				{#if moodPlatform}
					<span class="flex items-center gap-1 px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded-full">
						{moodPlatform}
						<button on:click={() => { moodPlatform = null; saveMood(); }} class="text-purple-400 hover:text-white leading-none">×</button>
					</span>
				{/if}
				<button
					on:click={() => (showMoodPicker = !showMoodPicker)}
					class="text-[10px] px-2 py-0.5 rounded transition-colors {showMoodPicker ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}"
				>
					{showMoodPicker ? 'done' : '+ mood'}
				</button>
				<button
					on:click={() => (showDebug = !showDebug)}
					class="text-[10px] px-2 py-0.5 rounded font-mono transition-colors {showDebug ? 'bg-yellow-400 text-gray-900' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}"
				>
					{showDebug ? 'debug: on' : 'debug'}
				</button>
			</div>
			{#if showMoodPicker}
				<div class="bg-gray-100 dark:bg-gray-800/80 rounded-lg p-3 mb-3 border border-gray-200 dark:border-gray-700">
					{#if moodGenreOptions.length > 0}
						<div class="mb-2">
							<p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Genre</p>
							<div class="flex flex-wrap gap-1.5">
								{#each moodGenreOptions as g}
									<button
										on:click={() => { moodGenre = moodGenre === g ? null : g; saveMood(); }}
										class="px-2 py-0.5 text-xs rounded-full transition-colors {moodGenre === g ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}"
									>{g}</button>
								{/each}
							</div>
						</div>
					{/if}
					{#if moodPlatformOptions.length > 0}
						<div>
							<p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Platform</p>
							<div class="flex flex-wrap gap-1.5">
								{#each moodPlatformOptions as p}
									<button
										on:click={() => { moodPlatform = moodPlatform === p ? null : p; saveMood(); }}
										class="px-2 py-0.5 text-xs rounded-full transition-colors {moodPlatform === p ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}"
									>{p}</button>
								{/each}
							</div>
						</div>
					{/if}
					{#if moodGenreOptions.length === 0 && moodPlatformOptions.length === 0}
						<p class="text-xs text-gray-500">Add genres and platforms to your games first.</p>
					{/if}
				</div>
			{/if}
			<div class="flex gap-3 overflow-x-auto pb-1">
				{#each nextUpGames as item (item.game.id)}
					{@const game = item.game}
					{@const t = getTargetHours(game)}
					{@const prog = Math.min(100, t > 0 ? (game.played_hours / t) * 100 : 0)}
					{@const progColor = prog < 30 ? 'bg-red-500' : prog < 70 ? 'bg-yellow-500' : 'bg-green-500'}
					{@const priorityConfig = { must_play: { icon: '★', color: 'text-yellow-400', label: 'Must Play' }, high: { icon: '●', color: 'text-gray-400', label: 'High' }, medium: { icon: '●', color: 'text-amber-600', label: 'Medium' }, low: { icon: '○', color: 'text-gray-600', label: 'Low' } }}
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
								<span class="text-xs {prio.color} flex-shrink-0" title={prio.label}>{prio.icon}</span>
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
							{#if showDebug}
							<div class="mt-1.5 border-t border-yellow-400/30 pt-1 space-y-0.5 font-mono text-[8px] text-yellow-400">
								<div class="flex justify-between"><span>score</span><span>{item.score.toFixed(4)}</span></div>
								<div class="flex justify-between"><span>P</span><span>{item.debug.P.toFixed(2)}</span></div>
								<div class="flex justify-between"><span>rest</span><span>{item.debug.restFactor.toFixed(3)}</span></div>
								<div class="flex justify-between"><span>recency</span><span>{item.debug.recencyFactor.toFixed(3)}</span></div>
								<div class="flex justify-between"><span>genre</span><span>{item.debug.genreFactor.toFixed(2)}</span></div>
								<div class="flex justify-between"><span>age</span><span>{item.debug.ageFactor.toFixed(3)}</span></div>
								<div class="flex justify-between"><span>status</span><span>{item.debug.statusFactor.toFixed(2)}</span></div>
								<div class="flex justify-between"><span>mood</span><span>{item.debug.moodFactor.toFixed(2)}</span></div>
							</div>
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
	{availablePlatforms}
/>
