<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { supabase } from '$lib/supabase/client';
	import GameCard from '$lib/components/GameCard.svelte';
	import GameDetailModal from '$lib/components/GameDetailModal.svelte';
	import type { Game } from '$lib/types';
	import type { Writable } from 'svelte/store';

	let games: Game[] = [];
	let loading = true;
	let selectedGame: Game | null = null;
	let showDetailModal = false;

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
		try {
			const { data: gamesData, error } = await supabase
				.from('games')
				.select('*')
				.order('created_at', { ascending: false });

			if (error) throw error;

			games = gamesData || [];
		} catch (error) {
			console.error('Error loading games:', error);
		} finally {
			loading = false;
		}
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

	onMount(() => {
		loadGames();

		// Register callback for when games are added
		const registerCallback = getContext<(callback: () => void) => void>(
			'registerGameAddedCallback'
		);
		if (registerCallback) {
			registerCallback(loadGames);
		}
	});
</script>

<div class="p-8">
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

	{#if loading}
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
