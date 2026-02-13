<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { supabase } from '$lib/supabase/client';
	import GameCard from '$lib/components/GameCard.svelte';
	import type { Game } from '$lib/types';

	let games: Game[] = [];
	let loading = true;

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
	<div class="mb-8">
		<h2 class="text-2xl font-bold text-white mb-2">Your Games</h2>
		<p class="text-gray-400">Track your progress and finish what you started</p>
	</div>

	{#if loading}
		<div class="text-center py-20 text-gray-500">
			<p class="text-lg">Loading games...</p>
		</div>
	{:else if games.length > 0}
		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
			{#each games as game (game.id)}
				<GameCard {game} />
			{/each}
		</div>
	{:else}
		<div class="text-center py-20 text-gray-500">
			<p class="text-lg">No games yet. Click "Add Game" to get started!</p>
		</div>
	{/if}
</div>
