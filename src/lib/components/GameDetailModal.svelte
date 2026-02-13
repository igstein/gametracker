<script lang="ts">
	import { supabase } from '$lib/supabase/client';
	import type { Game, GameStatus, GamePriority } from '$lib/types';

	export let game: Game | null;
	export let open = false;
	export let onClose: () => void;
	export let onGameUpdated: () => void;

	let hoursToAdd = 0;
	let minutesToAdd = 0;
	let status: GameStatus = 'backlog';
	let priority: GamePriority = 'medium';
	let saving = false;
	let error = '';

	// Update local values when game changes
	$: if (game) {
		status = game.status;
		priority = game.priority;
		hoursToAdd = 0;
		minutesToAdd = 0;
	}

	// Calculate target hours
	$: targetHours = game?.main_story_hours && game?.main_plus_extras_hours
		? (game.main_story_hours + game.main_plus_extras_hours) / 2
		: 50;

	// Calculate progress
	$: progress = game ? Math.min(100, (game.played_hours / targetHours) * 100) : 0;

	// Progress bar color
	$: progressColor =
		progress < 30 ? 'bg-red-500' : progress < 70 ? 'bg-yellow-500' : 'bg-green-500';

	// Priority config
	const priorityConfig = {
		must_play: { icon: '★', label: 'Must Play' },
		high: { icon: '●', label: 'High' },
		medium: { icon: '●', label: 'Medium' },
		low: { icon: '○', label: 'Low' }
	};

	async function handleUpdate() {
		if (!game) return;

		saving = true;
		error = '';

		try {
			const hoursAdded = hoursToAdd + minutesToAdd / 60;
			const newPlayedHours = game.played_hours + hoursAdded;

			const { error: updateError } = await supabase
				.from('games')
				.update({
					played_hours: newPlayedHours,
					status,
					priority,
					last_played: new Date().toISOString()
				})
				.eq('id', game.id);

			if (updateError) throw updateError;

			onGameUpdated();
			onClose();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update game';
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

{#if open && game}
	<div
		class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
		on:click={handleBackdropClick}
		role="button"
		tabindex="-1"
	>
		<div class="bg-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
			<div class="flex items-start justify-between mb-6">
				<div>
					<h2 class="text-2xl font-bold text-white mb-2">{game.title}</h2>
					<div class="flex items-center gap-2 text-sm text-gray-400">
						<span>Status: {status}</span>
						<span>•</span>
						<span>Priority: {priorityConfig[priority].icon} {priorityConfig[priority].label}</span>
					</div>
				</div>
			</div>

			<!-- Progress Section -->
			<div class="bg-gray-700 rounded-lg p-4 mb-6">
				<div class="flex justify-between text-sm text-gray-300 mb-2">
					<span>Progress</span>
					<span>{progress.toFixed(1)}%</span>
				</div>
				<div class="w-full bg-gray-600 rounded-full h-3 overflow-hidden mb-3">
					<div class="{progressColor} h-full transition-all" style="width: {progress}%"></div>
				</div>
				<div class="flex justify-between text-sm">
					<span class="text-white font-semibold">{game.played_hours.toFixed(1)} hours played</span>
					<span class="text-gray-400">Target: {targetHours.toFixed(0)} hours</span>
				</div>
			</div>

			<!-- Update Form -->
			<form on:submit|preventDefault={handleUpdate} class="space-y-4">
				<!-- Add Playtime -->
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-2">Add Playtime</label>
					<div class="flex gap-3">
						<div class="flex-1">
							<input
								type="number"
								bind:value={hoursToAdd}
								min="0"
								placeholder="Hours"
								class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
							/>
						</div>
						<div class="flex-1">
							<input
								type="number"
								bind:value={minutesToAdd}
								min="0"
								max="59"
								placeholder="Minutes"
								class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
							/>
						</div>
					</div>
					<p class="text-xs text-gray-500 mt-1">
						{#if hoursToAdd > 0 || minutesToAdd > 0}
							New total: {(game.played_hours + hoursToAdd + minutesToAdd / 60).toFixed(1)} hours
						{:else}
							Enter hours and/or minutes to add
						{/if}
					</p>
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
					<label for="priority" class="block text-sm font-medium text-gray-300 mb-2">Priority</label>
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
						{saving ? 'Updating...' : 'Update Game'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
