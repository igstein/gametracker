<script lang="ts">
	import GameCard from '$lib/components/GameCard.svelte';
	import type { Game } from '$lib/types';

	// Mock data for testing the UI
	const mockGames: Game[] = [
		{
			id: '1',
			title: 'The Legend of Zelda: Tears of the Kingdom',
			played_hours: 45,
			main_story_hours: 52,
			main_plus_extras_hours: 85,
			status: 'playing',
			priority: 'must_play'
		},
		{
			id: '2',
			title: 'Elden Ring',
			played_hours: 24,
			main_story_hours: 53,
			main_plus_extras_hours: 98,
			status: 'playing',
			priority: 'high'
		},
		{
			id: '3',
			title: 'Hades',
			played_hours: 18,
			main_story_hours: 22,
			main_plus_extras_hours: 28,
			status: 'playing',
			priority: 'medium'
		},
		{
			id: '4',
			title: 'Final Fantasy XVI',
			played_hours: 5,
			main_story_hours: 35,
			main_plus_extras_hours: 50,
			status: 'backlog',
			priority: 'low'
		}
	];
</script>

<div class="p-8">
	<div class="mb-8">
		<h2 class="text-2xl font-bold text-white mb-2">Your Games</h2>
		<p class="text-gray-400">Track your progress and finish what you started</p>
	</div>

	{#if mockGames.length > 0}
		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
			{#each mockGames as game (game.id)}
				<GameCard {game} />
			{/each}
		</div>
	{:else}
		<div class="text-center py-20 text-gray-500">
			<p class="text-lg">No games yet. Click "Add Game" to get started!</p>
		</div>
	{/if}
</div>
