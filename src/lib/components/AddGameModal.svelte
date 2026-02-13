<script lang="ts">
	import { supabase } from '$lib/supabase/client';
	import type { GameStatus, GamePriority } from '$lib/types';

	export let open = false;
	export let onClose: () => void;
	export let onGameAdded: () => void;

	let title = '';
	let targetHours = 50;
	let playedHours = 0;
	let status: GameStatus = 'backlog';
	let priority: GamePriority = 'medium';
	let saving = false;
	let error = '';

	async function handleSubmit() {
		if (!title.trim()) {
			error = 'Title is required';
			return;
		}

		saving = true;
		error = '';

		try {
			// For now, use a temporary user_id (we'll add auth later)
			const tempUserId = '00000000-0000-0000-0000-000000000000';

			// Calculate main_story and main_plus_extras from target
			// Target = average, so we reverse engineer realistic values
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

			// Reset form
			title = '';
			targetHours = 50;
			playedHours = 0;
			status = 'backlog';
			priority = 'medium';

			onGameAdded();
			onClose();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add game';
		} finally {
			saving = false;
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
		on:click={handleBackdropClick}
		role="button"
		tabindex="-1"
	>
		<div class="bg-gray-800 rounded-lg max-w-md w-full p-6">
			<h2 class="text-2xl font-bold text-white mb-6">Add Game</h2>

			<form on:submit|preventDefault={handleSubmit} class="space-y-4">
				<!-- Title -->
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

				<!-- Target Hours -->
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
					<p class="text-xs text-gray-500 mt-1">Estimated time to complete</p>
				</div>

				<!-- Played Hours -->
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

				<!-- Status -->
				<div>
					<label for="status" class="block text-sm font-medium text-gray-300 mb-2">Status</label>
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

				<!-- Priority -->
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

				<!-- Buttons -->
				<div class="flex gap-3 pt-4">
					<button
						type="button"
						on:click={onClose}
						disabled={saving}
						class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
					>
						Cancel
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
		</div>
	</div>
{/if}
