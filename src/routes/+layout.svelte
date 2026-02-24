<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import AddGameModal from '$lib/components/AddGameModal.svelte';
	import { writable } from 'svelte/store';
	import { setContext } from 'svelte';

	const showAddGameModal = writable(false);
	const activeFilter = writable<string>('all');
	const sortBy = writable<string>('created_at_desc');

	let onGameAddedCallback: (() => void) | null = null;

	setContext('registerGameAddedCallback', (callback: () => void) => {
		onGameAddedCallback = callback;
	});

	setContext('activeFilter', activeFilter);
	setContext('sortBy', sortBy);

	function openAddGameModal() {
		showAddGameModal.set(true);
	}

	function closeAddGameModal() {
		showAddGameModal.set(false);
	}

	function handleGameAdded() {
		if (onGameAddedCallback) {
			onGameAddedCallback();
		}
	}

	function handleFilterChange(filter: string) {
		activeFilter.set(filter);
	}
</script>

<div class="flex h-screen bg-gray-900">
	<Sidebar onAddGame={openAddGameModal} onFilterChange={handleFilterChange} activeFilter={$activeFilter} />
	<main class="flex-1 overflow-y-auto">
		<slot />
	</main>
</div>

<AddGameModal
	open={$showAddGameModal}
	onClose={closeAddGameModal}
	onGameAdded={handleGameAdded}
/>
