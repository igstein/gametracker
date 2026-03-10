<script lang="ts">
	import type { Game } from '$lib/types';
	import { getTargetHours } from '$lib/utils';

	export let game: Game;
	export let onClick: () => void;

	const targetHours = getTargetHours(game);

	// Calculate progress percentage
	const progress = targetHours > 0 ? Math.min(100, (game.played_hours / targetHours) * 100) : -1;

	// Determine progress bar color
	let progressColor = '';
	if (progress < 30) {
		progressColor = 'bg-red-500';
	} else if (progress < 70) {
		progressColor = 'bg-yellow-500';
	} else {
		progressColor = 'bg-green-500';
	}

	// Priority icon and color
	const priorityConfig = {
		must_play: { icon: '★', color: 'text-yellow-400', label: 'Must Play' },
		high: { icon: '●', color: 'text-gray-400', label: 'High' },
		medium: { icon: '●', color: 'text-amber-600', label: 'Medium' },
		low: { icon: '○', color: 'text-gray-600', label: 'Low' }
	};

	const priority = priorityConfig[game.priority];
</script>

<div
	class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer border relative {game.status === 'finished' ? 'border-green-500' : game.status === 'abandoned' ? 'border-gray-400' : 'border-gray-200 dark:border-gray-700'}"
	on:click={onClick}
	role="button"
	tabindex="0"
	on:keydown={(e) => e.key === 'Enter' && onClick()}
>
	{#if game.status === 'finished'}
		<span class="absolute top-1.5 right-1.5 z-10 bg-green-600 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wide">✓ Finished</span>
	{:else if game.status === 'abandoned'}
		<span class="absolute top-1.5 right-1.5 z-10 bg-gray-400 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wide">✗ Abandoned</span>
	{/if}
	<!-- Cover Image -->
	<div class="aspect-[2/3] bg-gray-200 dark:bg-gray-700 flex items-center justify-center relative">
		{#if game.cover_image_url}
			<img
				src={game.cover_image_url}
				alt={game.title}
				class="w-full h-full object-cover"
				style={game.status === 'finished' ? 'filter: brightness(0.5) saturate(0.7);' : game.status === 'abandoned' ? 'filter: brightness(0.35) saturate(0.4);' : ''}
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

		<!-- Progress Bar -->
		{#if progress >= 0}
		<div class="space-y-1.5">
			<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
				<div class="{progressColor} h-full transition-all" style="width: {progress}%"></div>
			</div>
			<div class="flex justify-between text-[10px] text-gray-600 dark:text-gray-400">
				<span>{Math.round(game.played_hours * 10) / 10}h / {targetHours.toFixed(0)}h</span>
				<span>{progress.toFixed(0)}%</span>
			</div>
		</div>
		{:else}
		<p class="text-[10px] text-amber-500 dark:text-amber-400">Set target time</p>
		{/if}
	</div>
</div>
