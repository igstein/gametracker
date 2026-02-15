<script lang="ts">
	import { supabase } from '$lib/supabase/client';
	import type { GameStatus, GamePriority, HLTBSearchResult } from '$lib/types';

	export let open = false;
	export let onClose: () => void;
	export let onGameAdded: () => void;

	let searchQuery = '';
	let searchResults: HLTBSearchResult[] = [];
	let searching = false;
	let searchError = '';
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	let showManualForm = false;
	let title = '';
	let targetHours = 50;
	let playedHours = 0;
	let status: GameStatus = 'backlog';
	let priority: GamePriority = 'medium';
	let saving = false;
	let error = '';

	async function performSearch(query: string) {
		if (!query || query.trim().length < 2) {
			searchResults = [];
			return;
		}

		searching = true;
		searchError = '';

		try {
			const response = await fetch('/api/hltb/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: query.trim() })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Search failed');
			}

			searchResults = data.results || [];

			if (searchResults.length === 0) {
				searchError = 'No games found. Try a different search or add manually.';
			}
		} catch (e) {
			searchError = e instanceof Error ? e.message : 'Search failed';
			searchResults = [];
		} finally {
			searching = false;
		}
	}

	function handleSearchInput(e: Event) {
		const input = e.target as HTMLInputElement;
		searchQuery = input.value;

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		debounceTimer = setTimeout(() => {
			performSearch(searchQuery);
		}, 500);
	}

	async function addGameFromHLTB(result: HLTBSearchResult) {
		saving = true;
		error = '';

		try {
			const tempUserId = '00000000-0000-0000-0000-000000000000';

			const { error: insertError } = await supabase.from('games').insert({
				user_id: tempUserId,
				title: result.title,
				hltb_id: result.id,
				cover_image_url: result.imageUrl,
				played_hours: 0,
				main_story_hours: result.mainStoryHours,
				main_plus_extras_hours: result.mainPlusExtrasHours,
				completionist_hours: result.completionistHours,
				status: 'backlog',
				priority: 'medium'
			});

			if (insertError) throw insertError;

			resetForm();
			onGameAdded();
			onClose();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add game';
		} finally {
			saving = false;
		}
	}

	async function handleManualSubmit() {
		if (!title.trim()) {
			error = 'Title is required';
			return;
		}

		saving = true;
		error = '';

		try {
			const tempUserId = '00000000-0000-0000-0000-000000000000';

			const mainStory = targetHours * 0.85;
			const mainPlusExtras = targetHours * 1.15;

			const { error: insertError } = await supabase.from('games').insert({
				user_id: tempUserId,
				title: title.trim(),
				played_hours: playedHours,
				main_story_hours: mainStory,
				main_plus_extras_hours: mainPlusExtras,
				status,
				priority
			});

			if (insertError) throw insertError;

			resetForm();
			onGameAdded();
			onClose();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add game';
		} finally {
			saving = false;
		}
	}

	function resetForm() {
		searchQuery = '';
		searchResults = [];
		searchError = '';
		showManualForm = false;
		title = '';
		targetHours = 50;
		playedHours = 0;
		status = 'backlog';
		priority = 'medium';
		error = '';
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			resetForm();
			onClose();
		}
	}

	function toggleManualForm() {
		showManualForm = !showManualForm;
	}
</script>

{#if open}
	<div
		class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
		on:click={handleBackdropClick}
		role="button"
		tabindex="-1"
	>
		<div class="bg-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
			<h2 class="text-2xl font-bold text-white mb-6">Add Game</h2>

			{#if !showManualForm}
				<!-- HLTB Search -->
				<div class="mb-6">
					<label for="search" class="block text-sm font-medium text-gray-300 mb-2">
						Search HowLongToBeat
					</label>
					<input
						id="search"
						type="text"
						value={searchQuery}
						on:input={handleSearchInput}
						placeholder="Search for a game..."
						class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
					/>
					{#if searching}
						<p class="text-sm text-gray-400 mt-2">Searching...</p>
					{/if}
					{#if searchError}
						<p class="text-sm text-yellow-500 mt-2">{searchError}</p>
					{/if}
				</div>

				<!-- Search Results -->
				{#if searchResults.length > 0}
					<div class="space-y-3 mb-6">
						<h3 class="text-sm font-medium text-gray-300">Results</h3>
						{#each searchResults as result}
							<div
								class="bg-gray-700 rounded-lg p-4 flex gap-4 hover:bg-gray-650 transition-colors"
							>
								{#if result.imageUrl}
									<img
										src={result.imageUrl}
										alt={result.title}
										class="w-16 h-20 object-cover rounded"
									/>
								{:else}
									<div class="w-16 h-20 bg-gray-600 rounded flex items-center justify-center">
										<span class="text-gray-500 text-xs">No Image</span>
									</div>
								{/if}
								<div class="flex-1">
									<h4 class="text-white font-medium mb-1">{result.title}</h4>
									<div class="text-xs text-gray-400 space-y-0.5">
										<p>Main Story: {result.mainStoryHours}h</p>
										<p>Main + Extras: {result.mainPlusExtrasHours}h</p>
										<p>Target: ~{result.targetHours}h</p>
									</div>
								</div>
								<button
									type="button"
									on:click={() => addGameFromHLTB(result)}
									disabled={saving}
									class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 self-center"
								>
									{saving ? 'Adding...' : 'Add'}
								</button>
							</div>
						{/each}
					</div>
				{/if}

				{#if error}
					<div class="text-red-500 text-sm mb-4">{error}</div>
				{/if}

				<!-- Manual Entry Toggle -->
				<div class="border-t border-gray-700 pt-4">
					<button
						type="button"
						on:click={toggleManualForm}
						class="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
					>
						Add manually without HLTB
					</button>
				</div>

				<!-- Cancel Button -->
				<div class="mt-4">
					<button
						type="button"
						on:click={() => {
							resetForm();
							onClose();
						}}
						class="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
					>
						Cancel
					</button>
				</div>
			{:else}
				<!-- Manual Entry Form -->
				<form on:submit|preventDefault={handleManualSubmit} class="space-y-4">
					<div>
						<label for="title" class="block text-sm font-medium text-gray-300 mb-2">
							Game Title *
						</label>
						<input
							id="title"
							type="text"
							bind:value={title}
							placeholder="Enter game title"
							class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
							required
						/>
					</div>

					<div>
						<label for="targetHours" class="block text-sm font-medium text-gray-300 mb-2">
							Target Hours
						</label>
						<input
							id="targetHours"
							type="number"
							bind:value={targetHours}
							min="1"
							step="0.5"
							class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
						/>
					</div>

					<div>
						<label for="playedHours" class="block text-sm font-medium text-gray-300 mb-2">
							Played Hours
						</label>
						<input
							id="playedHours"
							type="number"
							bind:value={playedHours}
							min="0"
							step="0.5"
							class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
						/>
					</div>

					<div>
						<label for="status" class="block text-sm font-medium text-gray-300 mb-2">
							Status
						</label>
						<select
							id="status"
							bind:value={status}
							class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
						>
							<option value="backlog">Backlog</option>
							<option value="playing">Playing</option>
							<option value="finished">Finished</option>
							<option value="abandoned">Abandoned</option>
						</select>
					</div>

					<div>
						<label for="priority" class="block text-sm font-medium text-gray-300 mb-2">
							Priority
						</label>
						<select
							id="priority"
							bind:value={priority}
							class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
						>
							<option value="must_play">★ Must Play</option>
							<option value="high">● High</option>
							<option value="medium">● Medium</option>
							<option value="low">○ Low</option>
						</select>
					</div>

					{#if error}
						<div class="text-red-500 text-sm">{error}</div>
					{/if}

					<div class="flex gap-3 pt-4">
						<button
							type="button"
							on:click={toggleManualForm}
							disabled={saving}
							class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
						>
							Back to Search
						</button>
						<button
							type="submit"
							disabled={saving}
							class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
						>
							{saving ? 'Adding...' : 'Add Game'}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}
