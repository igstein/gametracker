<script lang="ts">
	import type { Game } from '$lib/types';
	import { getTargetHours } from '$lib/utils';
	import StarRating from './StarRating.svelte';

	export let game: Game;
	// true right after finishing (shows the celebration), false when just editing the rating
	export let celebrate = true;
	// Resolves to an error message, or null when saved
	export let onSave: (rating: number | null, verdict: string | null) => Promise<string | null>;
	export let onClose: () => void;

	const VERDICT_MAX = 140;

	let rating: number | null = game.rating ?? null;
	let verdict = game.verdict ?? '';
	let saving = false;
	let saveError: string | null = null;

	$: target = getTargetHours(game);
	$: daysTaken = game.date_added
		? Math.max(
				1,
				Math.round(
					(new Date(game.finished_at ?? Date.now()).getTime() -
						new Date(game.date_added).getTime()) /
						86_400_000
				)
			)
		: null;

	async function save() {
		saving = true;
		saveError = await onSave(rating, verdict.trim() || null);
		saving = false;
		if (!saveError) onClose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}
</script>

<div
	class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
	on:click={handleBackdropClick}
	on:keydown={(e) => e.key === 'Escape' && onClose()}
	role="button"
	tabindex="-1"
>
	<div class="relative bg-gray-800 rounded-xl max-w-md w-full overflow-hidden text-center">
		{#if celebrate}
			<!-- Falling confetti -->
			<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
				{#each Array(18) as _, i}
					<span
						class="confetti"
						style="left: {(i * 53) % 100}%; animation-delay: {(i % 6) * 0.25}s; background: {[
							'#FFD700',
							'#22c55e',
							'#3b82f6',
							'#ef4444',
							'#a855f7',
							'#f97316'
						][i % 6]};"
					></span>
				{/each}
			</div>
		{/if}

		<div class="relative p-6">
			{#if game.cover_image_url}
				<img
					src={game.cover_image_url}
					alt={game.title}
					class="mx-auto w-24 h-36 object-cover rounded-lg shadow-lg mb-4"
				/>
			{/if}

			{#if celebrate}
				<p class="text-3xl mb-1">🏆</p>
				<h2 class="text-2xl font-bold text-white">You finished it!</h2>
				<p class="text-gray-300 mt-1">{game.title}</p>

				<div class="mt-4 flex justify-center gap-6 text-sm">
					<div>
						<p class="text-xl font-bold text-white">{Math.round(game.played_hours * 10) / 10}h</p>
						<p class="text-gray-400">played</p>
					</div>
					{#if daysTaken !== null}
						<div>
							<p class="text-xl font-bold text-white">{daysTaken}</p>
							<p class="text-gray-400">day{daysTaken === 1 ? '' : 's'} since added</p>
						</div>
					{/if}
					{#if target > 0}
						<div>
							<p class="text-xl font-bold text-white">{Math.round(target)}h</p>
							<p class="text-gray-400">target</p>
						</div>
					{/if}
				</div>
			{:else}
				<h2 class="text-xl font-bold text-white">{game.title}</h2>
			{/if}

			<div class="mt-6">
				<p class="text-sm text-gray-300 mb-2">How was it?</p>
				<StarRating {rating} size="lg" onChange={(r) => (rating = rating === r ? null : r)} />
				<p class="mt-1 text-sm text-gray-400 tabular-nums">{rating ? `${rating} / 10` : 'Not rated'}</p>
			</div>

			<div class="mt-4 text-left">
				<label for="verdict" class="block text-sm text-gray-300 mb-1">Your verdict in one line</label>
				<input
					id="verdict"
					type="text"
					bind:value={verdict}
					maxlength={VERDICT_MAX}
					placeholder="e.g. Gorgeous world, the ending made it all worth it."
					class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-500"
				/>
				<p class="text-right text-[10px] text-gray-500 mt-0.5">{verdict.length}/{VERDICT_MAX}</p>
			</div>

			{#if saveError}
				<p class="mt-3 text-left text-sm text-red-400">Couldn't save: {saveError}</p>
			{/if}

			<div class="mt-4 flex gap-2 justify-end">
				<button
					type="button"
					on:click={onClose}
					class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
				>
					{celebrate ? 'Skip' : 'Cancel'}
				</button>
				<button
					type="button"
					on:click={save}
					disabled={saving}
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
				>
					{saving ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.confetti {
		position: absolute;
		top: -12px;
		width: 8px;
		height: 12px;
		border-radius: 2px;
		opacity: 0.9;
		animation: fall 2.8s ease-in forwards;
	}

	@keyframes fall {
		to {
			transform: translateY(520px) rotate(540deg);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.confetti {
			display: none;
		}
	}
</style>
