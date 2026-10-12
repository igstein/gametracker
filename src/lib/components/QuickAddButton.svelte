<script lang="ts">
	export let onAdd: () => void;
	export let size: 'sm' | 'xs' = 'sm';
</script>

<!-- Stops propagation so tapping it doesn't also open the game's detail view -->
<button
	type="button"
	on:click|stopPropagation={onAdd}
	on:keydown|stopPropagation
	title="Add 1 hour of playtime"
	class="flex-shrink-0 font-semibold rounded bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white active:scale-95 transition {size ===
	'xs'
		? 'text-[9px] px-1.5 py-0.5'
		: 'text-[10px] px-2 py-0.5'}"
>
	+1h
</button>
