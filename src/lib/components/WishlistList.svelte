<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { Game } from '$lib/types';
	import { getTargetHours } from '$lib/utils';
	import { PRIORITY_CONFIG } from '$lib/constants';

	export let games: Game[] = [];
	export let onOpenGame: (game: Game) => void;
	// When the sidebar platform filter is active, only that section is shown and always open
	export let platformFilter: string = 'all';

	const STORAGE_KEY_OPEN = 'gametracker_wishlist_open_platforms';
	const NO_PLATFORM = 'No platform';

	let openPlatforms = new Set<string>();

	// One section per platform; games on several platforms appear in each of them.
	// Order within a section follows the incoming (already sorted) list.
	$: sections = (() => {
		const map = new Map<string, Game[]>();
		for (const game of games) {
			const platforms = game.platform?.length ? game.platform : [NO_PLATFORM];
			for (const p of platforms) {
				if (platformFilter !== 'all' && p !== platformFilter) continue;
				if (!map.has(p)) map.set(p, []);
				map.get(p)!.push(game);
			}
		}
		return [...map.entries()]
			.sort(([a], [b]) => {
				if (a === NO_PLATFORM) return 1;
				if (b === NO_PLATFORM) return -1;
				return a.localeCompare(b);
			})
			.map(([platform, list]) => ({ platform, games: list }));
	})();

	$: forceOpen = platformFilter !== 'all' || sections.length === 1;
	$: allOpen = sections.every((s) => openPlatforms.has(s.platform));

	function saveOpen() {
		if (browser) localStorage.setItem(STORAGE_KEY_OPEN, JSON.stringify([...openPlatforms]));
	}

	function toggle(platform: string) {
		if (openPlatforms.has(platform)) openPlatforms.delete(platform);
		else openPlatforms.add(platform);
		openPlatforms = openPlatforms;
		saveOpen();
	}

	function toggleAll() {
		openPlatforms = allOpen ? new Set() : new Set(sections.map((s) => s.platform));
		saveOpen();
	}

	onMount(() => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY_OPEN);
			if (stored) openPlatforms = new Set(JSON.parse(stored));
		} catch {
			localStorage.removeItem(STORAGE_KEY_OPEN);
		}
	});
</script>

<div class="max-w-4xl space-y-3">
	{#if !forceOpen}
		<div class="flex justify-end">
			<button
				type="button"
				on:click={toggleAll}
				class="text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
			>
				{allOpen ? 'Collapse all' : 'Expand all'}
			</button>
		</div>
	{/if}

	{#each sections as section (section.platform)}
		{@const open = forceOpen || openPlatforms.has(section.platform)}
		<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
			<button
				type="button"
				on:click={() => toggle(section.platform)}
				disabled={forceOpen}
				aria-expanded={open}
				class="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
			>
				<span class="w-4 text-gray-400 dark:text-gray-500 text-sm">{open ? '▾' : '▸'}</span>
				<span class="font-semibold {section.platform === NO_PLATFORM ? 'text-gray-500 dark:text-gray-400 italic' : 'text-gray-900 dark:text-white'}">{section.platform}</span>
				<span class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full tabular-nums">{section.games.length}</span>
			</button>

			{#if open}
				<div class="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60">
					<!-- Column headings (desktop only; on phones other platforms move under the title) -->
					<div
						class="hidden sm:grid grid-cols-[1.5rem_2rem_1fr_4rem_12rem] gap-3 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400"
					>
						<span></span>
						<span></span>
						<span>Game</span>
						<span class="text-right">Target</span>
						<span>Also on</span>
					</div>

					{#each section.games as game (game.id)}
						{@const priority = PRIORITY_CONFIG[game.priority]}
						{@const target = getTargetHours(game)}
						{@const otherPlatforms = (game.platform ?? []).filter((p) => p !== section.platform)}
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
								{#if otherPlatforms.length}
									<span class="sm:hidden block text-xs text-gray-500 dark:text-gray-400 truncate">
										Also on {otherPlatforms.join(' · ')}
									</span>
								{/if}
							</span>

							<span class="text-right text-sm tabular-nums {target > 0 ? 'text-gray-900 dark:text-white' : 'text-amber-500 dark:text-amber-400 text-xs'}">
								{target > 0 ? `${Math.round(target)}h` : 'No time'}
							</span>

							<span class="hidden sm:flex flex-wrap gap-1">
								{#if otherPlatforms.length}
									{#each otherPlatforms as p}
										<span class="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-[11px] rounded-full">{p}</span>
									{/each}
								{:else}
									<span class="text-xs text-gray-400 dark:text-gray-500">—</span>
								{/if}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>
