<script lang="ts">
	import type { Game } from '$lib/types';

	export let game: Game;
	export let onClick: () => void;

	const priorityConfig = {
		must_play: { icon: '★', color: 'text-yellow-400', label: 'Must Play' },
		high: { icon: '●', color: 'text-gray-400', label: 'High' },
		medium: { icon: '●', color: 'text-amber-600', label: 'Medium' },
		low: { icon: '○', color: 'text-gray-600', label: 'Low' }
	};

	const priority = priorityConfig[game.priority];

	$: mainHours = game.main_story_hours ? Math.round(game.main_story_hours) : null;
	$: extrasHours = game.main_plus_extras_hours ? Math.round(game.main_plus_extras_hours) : null;
</script>

<div
	class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer border border-purple-400/30 dark:border-purple-500/20 hover:border-purple-400/60 dark:hover:border-purple-500/40 relative"
	on:click={onClick}
	role="button"
	tabindex="0"
	on:keydown={(e) => e.key === 'Enter' && onClick()}
>
	<!-- Cover Image -->
	<div class="aspect-[2/3] bg-gray-200 dark:bg-gray-700 flex items-center justify-center relative">
		{#if game.cover_image_url}
			<img
				src={game.cover_image_url}
				alt={game.title}
				class="w-full h-full object-cover"
			/>
		{:else}
			<span class="text-4xl">🎮</span>
		{/if}
	</div>

	<!-- Game Info -->
	<div class="p-3">
		<div class="flex items-start justify-between gap-1.5 mb-2">
			<h3 class="font-semibold text-gray-900 dark:text-white text-xs line-clamp-2 flex-1">{game.title}</h3>
			<span class="text-base {priority.color} flex-shrink-0" title={priority.label}>{priority.icon}</span>
		</div>

		<!-- Platforms -->
		{#if game.platform?.length}
			<div class="flex flex-wrap gap-1 mb-2">
				{#each game.platform as p}
					<span class="px-1.5 py-0.5 bg-indigo-900/40 text-indigo-300 text-[9px] rounded-full">{p}</span>
				{/each}
			</div>
		{/if}

		<!-- HLTB Times -->
		<div class="text-[10px] text-gray-500 dark:text-gray-400 space-y-0.5">
			{#if mainHours}
				<div class="flex justify-between">
					<span>Main</span>
					<span class="text-gray-300">{mainHours}h</span>
				</div>
			{/if}
			{#if extrasHours}
				<div class="flex justify-between">
					<span>Main + Extra</span>
					<span class="text-gray-300">{extrasHours}h</span>
				</div>
			{/if}
			{#if !mainHours && !extrasHours}
				<span class="text-amber-500 dark:text-amber-400">No time data</span>
			{/if}
		</div>
	</div>
</div>
