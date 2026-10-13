<script lang="ts">
	import { onMount } from 'svelte';
	import type { Game } from '$lib/types';
	import { getColdDays, COLD_AFTER_DAYS } from '$lib/utils';

	export let games: Game[] = [];
	export let onOpenGame: (game: Game) => void;
	export let onMoveToBacklog: (game: Game) => void;

	const STORAGE_KEY_HIDDEN_UNTIL = 'gametracker_cold_hidden_until';
	const HIDE_MS = 7 * 86_400_000;

	let hiddenUntil = 0;

	$: coldGames = games
		.map((game) => ({ game, days: getColdDays(game) }))
		.filter((c): c is { game: Game; days: number } => c.days !== null)
		.sort((a, b) => b.days - a.days);

	function hide() {
		hiddenUntil = Date.now() + HIDE_MS;
		try {
			localStorage.setItem(STORAGE_KEY_HIDDEN_UNTIL, String(hiddenUntil));
		} catch {
			// Storage unavailable: hide for this session only
		}
	}

	onMount(() => {
		try {
			hiddenUntil = Number(localStorage.getItem(STORAGE_KEY_HIDDEN_UNTIL)) || 0;
		} catch {
			hiddenUntil = 0;
		}
	});
</script>

{#if coldGames.length > 0 && Date.now() >= hiddenUntil}
	<div
		class="mb-8 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg px-4 py-3"
	>
		<div class="flex items-start justify-between gap-3 mb-2">
			<div>
				<p class="text-sm font-semibold text-sky-900 dark:text-sky-200">
					❄ {coldGames.length === 1 ? 'This game has' : 'These games have'} gone cold
				</p>
				<p class="text-xs text-sky-800/80 dark:text-sky-300/80">
					Not played in over {COLD_AFTER_DAYS} days. Resume, or move to Backlog?
				</p>
			</div>
			<button
				on:click={hide}
				title="Hide for 7 days"
				class="text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-white text-xl leading-none"
			>
				×
			</button>
		</div>

		<ul class="divide-y divide-sky-200/70 dark:divide-sky-800/70">
			{#each coldGames as { game, days } (game.id)}
				<li class="flex items-center justify-between gap-3 py-1.5">
					<button
						on:click={() => onOpenGame(game)}
						class="min-w-0 text-left text-sm text-gray-900 dark:text-white hover:underline truncate"
					>
						{game.title}
						<span class="text-xs text-sky-700 dark:text-sky-300">· {days} days</span>
					</button>
					<button
						on:click={() => onMoveToBacklog(game)}
						class="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded bg-white dark:bg-gray-800 border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
					>
						Move to Backlog
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/if}
