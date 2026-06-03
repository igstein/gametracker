<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { Game } from '$lib/types';
	import { getTargetHours, scoreGame, getMostRecentGenres } from '$lib/utils';
	import { PRIORITY_CONFIG } from '$lib/constants';

	export let games: Game[] = [];
	export let onOpenGame: (game: Game) => void;

	const STORAGE_KEY_OPEN = 'gametracker_nextup_open';
	const STORAGE_KEY_MOOD = 'gametracker_mood';

	let nextUpOpen = false;
	let showMoodPicker = false;
	let showDebug = false;

	let moodGenre: string | null = null;
	let moodDevice: string | null = null;
	let moodSetting: string | null = null;

	$: candidates = games.filter((g) => g.status === 'playing' || g.status === 'backlog');
	$: recentGenres = getMostRecentGenres(games);

	$: moodGenreOptions = [...new Set(games.flatMap((g) => g.genre ?? []))].sort();
	$: moodDeviceOptions = [...new Set(games.flatMap((g) => g.devices ?? []))].sort();
	$: moodSettingOptions = [...new Set(games.flatMap((g) => g.setting ?? []))].sort();

	$: nextUpGames = candidates
		.map((game) => ({
			game,
			...scoreGame(game, { recentGenres, moodGenre, moodDevice, moodSetting })
		}))
		.sort((a, b) => b.score - a.score)
		.slice(0, 3);

	function toggleNextUp() {
		nextUpOpen = !nextUpOpen;
		if (browser) localStorage.setItem(STORAGE_KEY_OPEN, String(nextUpOpen));
	}

	function loadOpen() {
		if (!browser) return;
		nextUpOpen = localStorage.getItem(STORAGE_KEY_OPEN) === 'true';
	}

	function loadMood() {
		if (!browser) return;
		const stored = localStorage.getItem(STORAGE_KEY_MOOD);
		if (!stored) return;
		try {
			const data = JSON.parse(stored);
			const setAt = new Date(data.setAt);
			const today7am = new Date();
			today7am.setHours(7, 0, 0, 0);
			if (setAt < today7am) {
				localStorage.removeItem(STORAGE_KEY_MOOD);
				return;
			}
			moodGenre = data.genre ?? null;
			moodDevice = data.device ?? null;
			moodSetting = data.setting ?? null;
		} catch {
			localStorage.removeItem(STORAGE_KEY_MOOD);
		}
	}

	function saveMood() {
		if (!browser) return;
		if (!moodGenre && !moodDevice && !moodSetting) {
			localStorage.removeItem(STORAGE_KEY_MOOD);
		} else {
			localStorage.setItem(
				STORAGE_KEY_MOOD,
				JSON.stringify({
					genre: moodGenre,
					device: moodDevice,
					setting: moodSetting,
					setAt: new Date().toISOString()
				})
			);
		}
	}

	onMount(() => {
		loadOpen();
		loadMood();
	});
</script>

{#if nextUpGames.length > 0}
	<div class="mb-8">
		<div class="flex items-center gap-2 mb-2 flex-wrap">
			<button
				on:click={toggleNextUp}
				class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
			>
				Next Up <span class="text-base">{nextUpOpen ? '▾' : '▸'}</span>
			</button>
			{#if nextUpOpen}
				{#if moodGenre}
					<span class="flex items-center gap-1 px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded-full">
						{moodGenre}
						<button on:click={() => { moodGenre = null; saveMood(); }} class="text-purple-400 hover:text-white leading-none">×</button>
					</span>
				{/if}
				{#if moodDevice}
					<span class="flex items-center gap-1 px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded-full">
						{moodDevice}
						<button on:click={() => { moodDevice = null; saveMood(); }} class="text-purple-400 hover:text-white leading-none">×</button>
					</span>
				{/if}
				{#if moodSetting}
					<span class="flex items-center gap-1 px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded-full">
						{moodSetting}
						<button on:click={() => { moodSetting = null; saveMood(); }} class="text-purple-400 hover:text-white leading-none">×</button>
					</span>
				{/if}
				<button
					on:click={() => (showMoodPicker = !showMoodPicker)}
					class="text-[10px] px-2 py-0.5 rounded transition-colors {showMoodPicker ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}"
				>
					{showMoodPicker ? 'done' : '+ mood'}
				</button>
				<button
					on:click={() => (showDebug = !showDebug)}
					class="text-[10px] px-2 py-0.5 rounded font-mono transition-colors {showDebug ? 'bg-yellow-400 text-gray-900' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}"
				>
					{showDebug ? 'debug: on' : 'debug'}
				</button>
			{/if}
		</div>
		{#if nextUpOpen}
			{#if showMoodPicker}
				<div class="bg-gray-100 dark:bg-gray-800/80 rounded-lg p-3 mb-3 border border-gray-200 dark:border-gray-700">
					{#if moodGenreOptions.length > 0}
						<div class="mb-2">
							<p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Genre</p>
							<div class="flex flex-wrap gap-1.5">
								{#each moodGenreOptions as g}
									<button
										on:click={() => { moodGenre = moodGenre === g ? null : g; saveMood(); }}
										class="px-2 py-0.5 text-xs rounded-full transition-colors {moodGenre === g ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}"
									>{g}</button>
								{/each}
							</div>
						</div>
					{/if}
					{#if moodSettingOptions.length > 0}
						<div class="mb-2">
							<p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Setting</p>
							<div class="flex flex-wrap gap-1.5">
								{#each moodSettingOptions as s}
									<button
										on:click={() => { moodSetting = moodSetting === s ? null : s; saveMood(); }}
										class="px-2 py-0.5 text-xs rounded-full transition-colors {moodSetting === s ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}"
									>{s}</button>
								{/each}
							</div>
						</div>
					{/if}
					{#if moodDeviceOptions.length > 0}
						<div>
							<p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Device</p>
							<div class="flex flex-wrap gap-1.5">
								{#each moodDeviceOptions as d}
									<button
										on:click={() => { moodDevice = moodDevice === d ? null : d; saveMood(); }}
										class="px-2 py-0.5 text-xs rounded-full transition-colors {moodDevice === d ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}"
									>{d}</button>
								{/each}
							</div>
						</div>
					{/if}
					{#if moodGenreOptions.length === 0 && moodSettingOptions.length === 0 && moodDeviceOptions.length === 0}
						<p class="text-xs text-gray-500">Add genres, settings, and devices to your games first.</p>
					{/if}
				</div>
			{/if}
			<div class="flex gap-3 overflow-x-auto pb-1">
				{#each nextUpGames as item (item.game.id)}
					{@const game = item.game}
					{@const t = getTargetHours(game)}
					{@const prog = Math.min(100, t > 0 ? (game.played_hours / t) * 100 : 0)}
					{@const progColor = prog < 30 ? 'bg-red-500' : prog < 70 ? 'bg-yellow-500' : 'bg-green-500'}
					{@const prio = PRIORITY_CONFIG[game.priority]}
					<div
						on:click={() => onOpenGame(game)}
						on:keydown={(e) => e.key === 'Enter' && onOpenGame(game)}
						role="button"
						tabindex="0"
						class="flex-shrink-0 w-28 lg:w-36 xl:w-40 bg-white dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer border relative transition-colors hover:bg-gray-50 dark:hover:bg-gray-750 {game.status === 'finished' ? 'border-green-500' : game.status === 'abandoned' ? 'border-gray-400' : 'border-gray-200 dark:border-gray-700'}"
					>
						{#if game.status === 'finished'}
							<span class="absolute top-1 right-1 z-10 bg-green-600 text-white text-[7px] font-bold uppercase px-1 py-0.5 rounded tracking-wide">✓</span>
						{:else if game.status === 'abandoned'}
							<span class="absolute top-1 right-1 z-10 bg-gray-400 text-white text-[7px] font-bold uppercase px-1 py-0.5 rounded tracking-wide">✗</span>
						{/if}
						<div class="aspect-[2/3] bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
							{#if game.cover_image_url}
								<img
									src={game.cover_image_url}
									alt={game.title}
									class="w-full h-full object-cover"
									style={game.status === 'finished' ? 'filter: brightness(0.5) saturate(0.7);' : game.status === 'abandoned' ? 'filter: brightness(0.35) saturate(0.4);' : ''}
								/>
							{:else}
								<span class="text-2xl">🎮</span>
							{/if}
						</div>
						<div class="p-2">
							<div class="flex items-start justify-between gap-1 mb-1.5">
								<h3 class="font-semibold text-gray-900 dark:text-white text-[10px] line-clamp-2 flex-1">{game.title}</h3>
								<span class="text-xs {prio.tailwindColor} flex-shrink-0" title={prio.label}>{prio.icon}</span>
							</div>
							{#if t > 0}
								<div class="space-y-1">
									<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
										<div class="{progColor} h-full transition-all" style="width: {prog}%"></div>
									</div>
									<div class="flex justify-between text-[9px] text-gray-600 dark:text-gray-400">
										<span>{Math.round(game.played_hours * 10) / 10}h / {t.toFixed(0)}h</span>
										<span>{prog.toFixed(0)}%</span>
									</div>
								</div>
							{:else}
								<p class="text-[9px] text-amber-500 dark:text-amber-400">Set target time</p>
							{/if}
							{#if showDebug}
								<div class="mt-1.5 border-t border-yellow-400/30 pt-1 space-y-0.5 font-mono text-[8px] text-yellow-400">
									<div class="flex justify-between"><span>score</span><span>{item.score.toFixed(4)}</span></div>
									<div class="flex justify-between"><span>P</span><span>{item.debug.P.toFixed(2)}</span></div>
									<div class="flex justify-between"><span>rest</span><span>{item.debug.restFactor.toFixed(3)}</span></div>
									<div class="flex justify-between"><span>prog</span><span>{item.debug.progressFactor.toFixed(3)}</span></div>
									<div class="flex justify-between"><span>started</span><span>{item.debug.startedFactor.toFixed(2)}</span></div>
									<div class="flex justify-between"><span>short</span><span>{item.debug.shortGameFactor.toFixed(3)}</span></div>
									<div class="flex justify-between"><span>recency</span><span>{item.debug.recencyFactor.toFixed(3)}</span></div>
									<div class="flex justify-between"><span>genre</span><span>{item.debug.genreFactor.toFixed(2)}</span></div>
									<div class="flex justify-between"><span>age</span><span>{item.debug.ageFactor.toFixed(3)}</span></div>
									<div class="flex justify-between"><span>status</span><span>{item.debug.statusFactor.toFixed(2)}</span></div>
									<div class="flex justify-between"><span>mood</span><span>{item.debug.moodFactor.toFixed(2)}</span></div>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
