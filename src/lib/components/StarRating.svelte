<script lang="ts">
	// Shows a 1–10 star rating; pass `onChange` to make it clickable
	const MAX_RATING = 10;
	export let rating: number | null | undefined = null;
	export let onChange: ((rating: number) => void) | null = null;
	export let size: 'xs' | 'sm' | 'lg' = 'sm';

	$: shown = rating ?? 0;
	$: sizeClass = size === 'lg' ? 'text-2xl gap-0.5' : size === 'sm' ? 'text-sm' : 'text-[10px]';
</script>

<span
	class="inline-flex items-center leading-none {sizeClass}"
	role={onChange ? 'radiogroup' : 'img'}
	aria-label={rating ? `${rating} out of ${MAX_RATING} stars` : 'Not rated'}
>
	{#each Array.from({ length: MAX_RATING }, (_, i) => i + 1) as star}
		{#if onChange}
			<button
				type="button"
				role="radio"
				aria-checked={rating === star}
				aria-label="{star} star{star === 1 ? '' : 's'}"
				on:click={() => onChange?.(star)}
				class="transition-transform hover:scale-110 {star <= shown ? 'text-yellow-400' : 'text-gray-500'}"
			>
				★
			</button>
		{:else}
			<span class={star <= shown ? 'text-yellow-400' : 'text-gray-400 dark:text-gray-600'}>★</span>
		{/if}
	{/each}
</span>
