<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import AddGameModal from '$lib/components/AddGameModal.svelte';
	import Auth from '$lib/components/Auth.svelte';
	import { writable } from 'svelte/store';
	import { setContext, onMount } from 'svelte';
	import { authStore, initAuth } from '$lib/stores/auth';
	import { isOnline, showOfflineBanner } from '$lib/stores/network';
	import { browser } from '$app/environment';

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

	async function registerServiceWorker() {
		if (!browser || !('serviceWorker' in navigator)) {
			console.log('[SW] Service Worker not supported');
			return;
		}

		try {
			const registration = await navigator.serviceWorker.register('/service-worker.js');
			console.log('[SW] Service Worker registered:', registration);

			// Check for updates
			registration.addEventListener('updatefound', () => {
				const newWorker = registration.installing;
				if (newWorker) {
					newWorker.addEventListener('statechange', () => {
						if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
							console.log('[SW] New version available - reload to update');
						}
					});
				}
			});
		} catch (error) {
			console.error('[SW] Service Worker registration failed:', error);
		}
	}

	onMount(() => {
		initAuth();
		registerServiceWorker();
	});
</script>

{#if $authStore.loading}
	<div class="min-h-screen bg-gray-900 flex items-center justify-center">
		<p class="text-gray-400 text-lg">Loading...</p>
	</div>
{:else if !$authStore.user}
	<Auth />
{:else}
	<!-- Offline Banner -->
	{#if $showOfflineBanner}
		<div
			class="fixed top-0 left-0 right-0 bg-yellow-900/90 border-b border-yellow-700 text-yellow-200 px-4 py-2 text-center text-sm z-50 backdrop-blur-sm"
		>
			📡 You're offline. Changes will sync when you reconnect.
		</div>
	{/if}

	<div class="flex h-screen bg-gray-900" class:pt-10={$showOfflineBanner}>
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
{/if}
