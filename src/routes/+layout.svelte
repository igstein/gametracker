<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import AddGameModal from '$lib/components/AddGameModal.svelte';
	import { writable } from 'svelte/store';
	import { setContext } from 'svelte';

	const showAddGameModal = writable(false);

	let onGameAddedCallback: (() => void) | null = null;

	setContext('registerGameAddedCallback', (callback: () => void) => {
		onGameAddedCallback = callback;
	});

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
</script>

<div class="flex h-screen bg-gray-900">
	<Sidebar onAddGame={openAddGameModal} />
	<main class="flex-1 overflow-y-auto">
		<slot />
	</main>
</div>

<AddGameModal
	open={$showAddGameModal}
	onClose={closeAddGameModal}
	onGameAdded={handleGameAdded}
/>
