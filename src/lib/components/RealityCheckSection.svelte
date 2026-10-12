<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { Game, GameStatus } from '$lib/types';
	import { getTargetHours } from '$lib/utils';
	import { STATUS_CONFIG } from '$lib/constants';

	export let games: Game[] = [];

	const STORAGE_KEY_OPEN = 'gametracker_reality_open';

	// Open statuses show hours still to play; closed ones show hours already played
	const STATUSES: { status: GameStatus; measure: 'left' | 'played' }[] = [
		{ status: 'playing', measure: 'left' },
		{ status: 'backlog', measure: 'left' },
		{ status: 'wishlist', measure: 'left' },
		{ status: 'finished', measure: 'played' },
		{ status: 'abandoned', measure: 'played' }
	];

	let open = true;

	$: tiles = STATUSES.map(({ status, measure }) => {
		const inStatus = games.filter((g) => g.status === status);
		let hours = 0;
		let withoutTarget = 0;
		for (const game of inStatus) {
			if (measure === 'played') {
				hours += game.played_hours;
				continue;
			}
			const target = getTargetHours(game);
			if (target > 0) hours += Math.max(0, target - game.played_hours);
			else withoutTarget++;
		}
		return { status, measure, count: inStatus.length, hours, withoutTarget };
	});

	// Only games you've committed to (not wishlist, not abandoned)
	$: totalLeft = tiles
		.filter((t) => t.status === 'playing' || t.status === 'backlog')
		.reduce((sum, t) => sum + t.hours, 0);

	function formatHours(hours: number): string {
		return `${Math.round(hours).toLocaleString()}h`;
	}

	function toggle() {
		open = !open;
		if (browser) localStorage.setItem(STORAGE_KEY_OPEN, String(open));
	}

	onMount(() => {
		open = localStorage.getItem(STORAGE_KEY_OPEN) !== 'false';
	});
</script>

{#if games.length > 0}
	<div class="mb-8">
		<div class="flex items-baseline gap-3 mb-2 flex-wrap">
			<button
				on:click={toggle}
				class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
			>
				Reality Check <span class="text-base">{open ? '▾' : '▸'}</span>
			</button>
			<span class="text-sm text-gray-500 dark:text-gray-400">
				{formatHours(totalLeft)} left to play in total
			</span>
		</div>

		{#if open}
			<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-w-[1800px]">
				{#each tiles as tile (tile.status)}
					<div
						class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3"
					>
						<p class="text-xs font-medium text-gray-500 dark:text-gray-400">
							{STATUS_CONFIG[tile.status].icon}
							{STATUS_CONFIG[tile.status].label}
						</p>
						<p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
							{formatHours(tile.hours)}
						</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							{tile.measure === 'left' ? 'left to play' : 'played'} ·
							{tile.count} game{tile.count === 1 ? '' : 's'}
						</p>
						{#if tile.withoutTarget > 0}
							<p class="mt-1 text-[10px] text-amber-500 dark:text-amber-400">
								+{tile.withoutTarget} without target time
							</p>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
