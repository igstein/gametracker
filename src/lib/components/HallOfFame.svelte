<script lang="ts">
	import type { Game } from '$lib/types';
	import StarRating from './StarRating.svelte';

	export let games: Game[] = [];
	export let onOpenGame: (game: Game) => void;
	export let onRateGame: (game: Game) => void;

	// Best rated first, unrated last; ties broken by most recently finished
	$: finished = games
		.filter((g) => g.status === 'finished')
		.sort((a, b) => {
			const byRating = (b.rating ?? 0) - (a.rating ?? 0);
			if (byRating !== 0) return byRating;
			return finishedTime(b) - finishedTime(a);
		});

	function finishedTime(game: Game): number {
		const date = game.finished_at ?? game.last_played;
		return date ? new Date(date).getTime() : 0;
	}

	function formatDate(game: Game): string | null {
		const date = game.finished_at ?? game.last_played;
		return date
			? new Date(date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
			: null;
	}
</script>

<div class="mb-8">
	<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">🏆 Hall of Fame</h2>
	<p class="text-gray-600 dark:text-gray-400">
		{finished.length} game{finished.length === 1 ? '' : 's'} finished
	</p>
</div>

{#if finished.length === 0}
	<div class="text-center py-20 text-gray-500">
		<p class="text-lg">No finished games yet. Your first one will show up here!</p>
	</div>
{:else}
	<ol class="space-y-3 max-w-3xl">
		{#each finished as game, i (game.id)}
			<li
				class="flex gap-4 items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
			>
				<span class="w-6 text-center text-sm font-bold text-gray-400 flex-shrink-0">{i + 1}</span>
				<button type="button" on:click={() => onOpenGame(game)} class="flex-shrink-0">
					{#if game.cover_image_url}
						<img src={game.cover_image_url} alt={game.title} class="w-12 h-16 object-cover rounded" />
					{:else}
						<div class="w-12 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">🎮</div>
					{/if}
				</button>
				<div class="flex-1 min-w-0">
					<button
						type="button"
						on:click={() => onOpenGame(game)}
						class="font-semibold text-gray-900 dark:text-white hover:underline text-left"
					>
						{game.title}
					</button>
					<div class="flex items-center gap-2 flex-wrap mt-0.5">
						{#if game.rating}
							<StarRating rating={game.rating} />
						{:else}
							<button
								type="button"
								on:click={() => onRateGame(game)}
								class="text-xs text-blue-500 dark:text-blue-400 hover:underline"
							>
								Rate this game
							</button>
						{/if}
						<span class="text-xs text-gray-500 dark:text-gray-400">
							{Math.round(game.played_hours * 10) / 10}h{#if formatDate(game)} · {formatDate(game)}{/if}
						</span>
					</div>
					{#if game.verdict}
						<p class="mt-1 text-sm italic text-gray-600 dark:text-gray-300">“{game.verdict}”</p>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
{/if}
