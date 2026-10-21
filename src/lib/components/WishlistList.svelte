<script lang="ts">
	import type { Game } from '$lib/types';
	import { getTargetHours } from '$lib/utils';
	import { PRIORITY_CONFIG } from '$lib/constants';

	export let games: Game[] = [];
	export let onOpenGame: (game: Game) => void;
</script>

<div
	class="max-w-4xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700/60"
>
	<!-- Column headings (desktop only; on phones platforms move under the title) -->
	<div
		class="hidden sm:grid grid-cols-[1.5rem_2rem_1fr_4rem_12rem] gap-3 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400"
	>
		<span></span>
		<span></span>
		<span>Game</span>
		<span class="text-right">Target</span>
		<span>Platforms</span>
	</div>

	{#each games as game (game.id)}
		{@const priority = PRIORITY_CONFIG[game.priority]}
		{@const target = getTargetHours(game)}
		<button
			type="button"
			on:click={() => onOpenGame(game)}
			class="w-full text-left grid grid-cols-[1.5rem_2rem_1fr_auto] sm:grid-cols-[1.5rem_2rem_1fr_4rem_12rem] gap-3 items-center px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
		>
			<span class="text-center text-base leading-none {priority.tailwindColor}" title={priority.label}>{priority.icon}</span>

			{#if game.cover_image_url}
				<img src={game.cover_image_url} alt="" loading="lazy" class="w-8 h-11 object-cover rounded" />
			{:else}
				<span class="w-8 h-11 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm">🎮</span>
			{/if}

			<span class="min-w-0">
				<span class="block text-sm font-medium text-gray-900 dark:text-white truncate">{game.title}</span>
				<span class="sm:hidden block text-xs text-gray-500 dark:text-gray-400 truncate">
					{game.platform?.length ? game.platform.join(' · ') : 'No platform set'}
				</span>
			</span>

			<span class="text-right text-sm tabular-nums {target > 0 ? 'text-gray-900 dark:text-white' : 'text-amber-500 dark:text-amber-400 text-xs'}">
				{target > 0 ? `${Math.round(target)}h` : 'No time'}
			</span>

			<span class="hidden sm:flex flex-wrap gap-1">
				{#if game.platform?.length}
					{#each game.platform as p}
						<span class="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-[11px] rounded-full">{p}</span>
					{/each}
				{:else}
					<span class="text-xs text-gray-400 dark:text-gray-500">—</span>
				{/if}
			</span>
		</button>
	{/each}
</div>
