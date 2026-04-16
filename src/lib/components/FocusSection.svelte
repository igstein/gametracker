<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { Game } from '$lib/types';
	import { getTargetHours } from '$lib/utils';

	export let games: Game[] = [];
	export let onOpenGame: (game: Game) => void;

	const STORAGE_KEY = 'gametracker_focus';
	const LOCK_MS = 7 * 24 * 60 * 60 * 1000;

	let focusGameIds: string[] = [];
	let setAt: string | null = null;
	let showPicker = false;
	let pickerSelected: string[] = [];
	let confirmingReset = false;

	$: locked = setAt !== null && Date.now() - new Date(setAt).getTime() < LOCK_MS;
	$: daysLeft = setAt
		? Math.ceil((new Date(setAt).getTime() + LOCK_MS - Date.now()) / 86_400_000)
		: 0;

	$: focusGames = focusGameIds
		.map((id) => games.find((g) => g.id === id))
		.filter((g): g is Game => g !== undefined);

	// Games available to pick: Playing or Backlog, not wishlist
	$: pickableGames = games.filter(
		(g) => g.status === 'playing' || g.status === 'backlog'
	);

	function loadFocus() {
		if (!browser) return;
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return;
		try {
			const data = JSON.parse(stored);
			focusGameIds = data.gameIds ?? [];
			setAt = data.setAt ?? null;
		} catch {
			localStorage.removeItem(STORAGE_KEY);
		}
	}

	function saveFocus(ids: string[]) {
		if (!browser) return;
		const now = new Date().toISOString();
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ gameIds: ids, setAt: now }));
		focusGameIds = ids;
		setAt = now;
	}

	function clearFocus() {
		if (!browser) return;
		localStorage.removeItem(STORAGE_KEY);
		focusGameIds = [];
		setAt = null;
		confirmingReset = false;
	}

	function togglePickerSelection(id: string) {
		if (pickerSelected.includes(id)) {
			pickerSelected = pickerSelected.filter((x) => x !== id);
		} else if (pickerSelected.length < 3) {
			pickerSelected = [...pickerSelected, id];
		} else {
			// Deselect oldest, add new
			pickerSelected = [...pickerSelected.slice(1), id];
		}
	}

	function openPicker() {
		pickerSelected = [...focusGameIds];
		showPicker = true;
	}

	function confirmPicker() {
		if (pickerSelected.length !== 3) return;
		saveFocus(pickerSelected);
		showPicker = false;
	}

	const statusLabel: Record<string, string> = {
		playing: '▶',
		backlog: '📋',
		finished: '✅',
		abandoned: '❌',
		wishlist: '💫'
	};

	const priorityConfig: Record<string, { icon: string; color: string }> = {
		must_play: { icon: '★', color: 'text-yellow-400' },
		high: { icon: '●', color: 'text-gray-400' },
		medium: { icon: '●', color: 'text-amber-600' },
		low: { icon: '○', color: 'text-gray-600' }
	};

	onMount(loadFocus);
</script>

<div class="mb-8">
	<!-- Header -->
	<div class="flex items-center gap-3 mb-3 flex-wrap">
		<h2 class="text-xl font-bold text-gray-900 dark:text-white">🎯 Focus Week</h2>
		{#if locked && setAt}
			<span class="text-xs text-blue-400 font-medium">
				{daysLeft} day{daysLeft !== 1 ? 's' : ''} left
			</span>
			{#if !confirmingReset}
				<button
					on:click={() => (confirmingReset = true)}
					class="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
				>
					reset early
				</button>
			{:else}
				<span class="text-[10px] text-red-400">
					Reset focus?
					<button on:click={clearFocus} class="underline hover:text-red-300 ml-1">Yes</button>
					<button on:click={() => (confirmingReset = false)} class="underline hover:text-gray-300 ml-1">No</button>
				</span>
			{/if}
		{/if}
	</div>

	{#if locked && focusGames.length > 0}
		<!-- Focus cards -->
		<div class="flex gap-3 overflow-x-auto pb-1">
			{#each focusGames as game (game.id)}
				{@const target = getTargetHours(game)}
				{@const prog = Math.min(100, target > 0 ? (game.played_hours / target) * 100 : 0)}
				{@const remaining = Math.max(0, target - game.played_hours)}
				{@const progColor = prog < 30 ? 'bg-red-500' : prog < 70 ? 'bg-yellow-500' : 'bg-green-500'}
				{@const prio = priorityConfig[game.priority]}
				<div
					on:click={() => onOpenGame(game)}
					on:keydown={(e) => e.key === 'Enter' && onOpenGame(game)}
					role="button"
					tabindex="0"
					class="flex-shrink-0 w-28 lg:w-36 xl:w-40 bg-white dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer border-l-4 border-l-blue-500 border-t border-r border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
				>
					<div class="aspect-[2/3] bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
						{#if game.cover_image_url}
							<img src={game.cover_image_url} alt={game.title} class="w-full h-full object-cover" />
						{:else}
							<span class="text-2xl">🎮</span>
						{/if}
					</div>
					<div class="p-2">
						<div class="flex items-start justify-between gap-1 mb-1">
							<h3 class="font-semibold text-gray-900 dark:text-white text-[10px] line-clamp-2 flex-1">{game.title}</h3>
							<span class="text-xs {prio.color} flex-shrink-0">{prio.icon}</span>
						</div>
						<div class="text-[9px] text-gray-500 dark:text-gray-400 mb-1.5">
							{statusLabel[game.status] ?? ''} {game.status}
						</div>
						{#if target > 0}
							<div class="space-y-1">
								<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
									<div class="{progColor} h-full transition-all" style="width: {prog}%"></div>
								</div>
								<div class="flex justify-between text-[9px] text-gray-600 dark:text-gray-400">
									<span>{prog.toFixed(0)}%</span>
									<span>{remaining.toFixed(0)}h left</span>
								</div>
							</div>
						{:else}
							<p class="text-[9px] text-amber-500">No target set</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<!-- Empty / expired state -->
		<div class="bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg px-5 py-4 flex items-center justify-between gap-4">
			<div>
				<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
					{setAt && !locked ? 'Focus week ended.' : 'No focus games set.'}
				</p>
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
					Commit to 3 games for the next 7 days.
				</p>
			</div>
			<button
				on:click={openPicker}
				class="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
			>
				Set focus games →
			</button>
		</div>
	{/if}
</div>

<!-- Picker modal -->
{#if showPicker}
	<div
		class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
		on:click={(e) => e.target === e.currentTarget && (showPicker = false)}
		role="button"
		tabindex="-1"
	>
		<div class="bg-gray-800 rounded-lg max-w-lg w-full p-6 max-h-[80vh] flex flex-col">
			<div class="flex items-center justify-between mb-1">
				<h2 class="text-xl font-bold text-white">Set Focus Games</h2>
				<button on:click={() => (showPicker = false)} class="text-gray-400 hover:text-white text-2xl leading-none">×</button>
			</div>
			<p class="text-gray-400 text-sm mb-4">Pick 3 games to focus on this week. They'll be locked for 7 days.</p>

			{#if pickableGames.length < 3}
				<p class="text-yellow-400 text-sm text-center py-8">
					You need at least 3 games in Playing or Backlog to set a focus week.
				</p>
			{:else}
				<div class="overflow-y-auto flex-1 space-y-2 pr-1">
					{#each pickableGames as game (game.id)}
						{@const selected = pickerSelected.includes(game.id)}
						{@const target = getTargetHours(game)}
						{@const remaining = Math.max(0, target - game.played_hours)}
						<button
							type="button"
							on:click={() => togglePickerSelection(game.id)}
							class="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left {selected
								? 'bg-blue-600/30 border border-blue-500'
								: 'bg-gray-700 border border-transparent hover:bg-gray-650 hover:border-gray-600'}"
						>
							{#if game.cover_image_url}
								<img src={game.cover_image_url} alt={game.title} class="w-10 h-14 object-cover rounded flex-shrink-0" />
							{:else}
								<div class="w-10 h-14 bg-gray-600 rounded flex items-center justify-center flex-shrink-0">
									<span class="text-lg">🎮</span>
								</div>
							{/if}
							<div class="flex-1 min-w-0">
								<p class="text-white text-sm font-medium truncate">{game.title}</p>
								<p class="text-gray-400 text-xs mt-0.5">
									{statusLabel[game.status]} {game.status}
									{#if target > 0}· {remaining.toFixed(0)}h left{/if}
								</p>
							</div>
							<div class="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center {selected ? 'bg-blue-500 border-blue-500' : 'border-gray-500'}">
								{#if selected}
									<span class="text-white text-[10px] font-bold">✓</span>
								{/if}
							</div>
						</button>
					{/each}
				</div>

				<div class="mt-4 flex items-center justify-between">
					<span class="text-gray-400 text-sm">{pickerSelected.length} / 3 selected</span>
					<div class="flex gap-2">
						<button
							type="button"
							on:click={() => (showPicker = false)}
							class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
						>
							Cancel
						</button>
						<button
							type="button"
							on:click={confirmPicker}
							disabled={pickerSelected.length !== 3}
							class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
						>
							Confirm ({pickerSelected.length}/3)
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
