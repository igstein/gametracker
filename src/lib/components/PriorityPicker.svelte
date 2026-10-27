<script lang="ts">
	import type { GamePriority } from '$lib/types';
	import { PRIORITY_CONFIG, PRIORITY_ORDER } from '$lib/constants';

	// Buttons instead of a <select>: browsers (Safari/iOS especially) ignore option colors
	export let value: GamePriority;
	export let labelId: string;

	const priorities = (Object.keys(PRIORITY_ORDER) as GamePriority[]).sort(
		(a, b) => PRIORITY_ORDER[a] - PRIORITY_ORDER[b]
	);
</script>

<div role="radiogroup" aria-labelledby={labelId} class="grid grid-cols-2 sm:grid-cols-4 gap-2">
	{#each priorities as p (p)}
		{@const config = PRIORITY_CONFIG[p]}
		{@const selected = value === p}
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			on:click={() => (value = p)}
			class="flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors {selected
				? 'bg-gray-600 border-blue-500 text-white'
				: 'bg-gray-700 border-transparent text-gray-300 hover:bg-gray-600'}"
		>
			<span class="text-base leading-none" style="color: {config.hexColor}">{config.icon}</span>
			{config.label}
		</button>
	{/each}
</div>
