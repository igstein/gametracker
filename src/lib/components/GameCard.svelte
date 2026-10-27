<script lang="ts">
	import type { Game, LatestNote } from '$lib/types';
	import { getTargetHours, getColdDays, formatDaysAgo } from '$lib/utils';
	import { PRIORITY_CONFIG } from '$lib/constants';
	import QuickAddButton from './QuickAddButton.svelte';
	import StarRating from './StarRating.svelte';

	export let game: Game;
	export let onClick: () => void;
	export let onQuickAdd: ((game: Game) => void) | null = null;
	export let lastNote: LatestNote | undefined = undefined;

	$: coldDays = getColdDays(game);

	$: canQuickAdd = onQuickAdd !== null && (game.status === 'playing' || game.status === 'backlog');

	$: targetHours = getTargetHours(game);

	$: progress = targetHours > 0 ? Math.min(100, (game.played_hours / targetHours) * 100) : -1;

	$: progressColor = progress < 30 ? 'bg-red-500' : progress < 70 ? 'bg-yellow-500' : 'bg-green-500';

	$: priority = PRIORITY_CONFIG[game.priority];
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
	{:else if coldDays !== null}
		<span
			class="absolute top-1.5 right-1.5 z-10 bg-sky-600/90 text-white text-[10.5px] font-bold px-[7px] py-[2.5px] rounded tracking-wide"
			title="Not played for {coldDays} days"
		>❄ {coldDays}d</span>
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
			<span class="text-base {priority.tailwindColor} flex-shrink-0" title={priority.label}>{priority.icon}</span>
		</div>
		{#if game.status === 'finished' && game.rating}
			<div class="-mt-1 mb-1.5"><StarRating rating={game.rating} size="xs" /></div>
		{/if}

		<!-- Progress Bar -->
		{#if progress >= 0}
		<div class="space-y-1.5">
			<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
				<div class="{progressColor} h-full transition-all" style="width: {progress}%"></div>
			</div>
			<div class="flex justify-between items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400">
				<span>{Math.round(game.played_hours * 10) / 10}h / {targetHours.toFixed(0)}h</span>
				<span class="flex items-center gap-1.5">
					{progress.toFixed(0)}%
					{#if canQuickAdd && onQuickAdd}
						<QuickAddButton onAdd={() => onQuickAdd?.(game)} />
					{/if}
				</span>
			</div>
		</div>
		{:else}
		<div class="flex justify-between items-center gap-1">
			<p class="text-[10px] text-amber-500 dark:text-amber-400">Set target time</p>
			{#if canQuickAdd && onQuickAdd}
				<QuickAddButton onAdd={() => onQuickAdd?.(game)} />
			{/if}
		</div>
		{/if}

		{#if lastNote}
			<p class="mt-2 text-[10px] leading-snug text-gray-500 dark:text-gray-400 line-clamp-2" title={lastNote.text}>
				📝 <span class="text-gray-400 dark:text-gray-500">{formatDaysAgo(lastNote.at)} ·</span> {lastNote.text}
			</p>
		{/if}
	</div>
</div>
