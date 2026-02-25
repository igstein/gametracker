<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import AddGameModal from '$lib/components/AddGameModal.svelte';
	import Auth from '$lib/components/Auth.svelte';
	import KeyboardShortcutsHelp from '$lib/components/KeyboardShortcutsHelp.svelte';
	import { writable } from 'svelte/store';
	import { setContext, onMount } from 'svelte';
	import { authStore, initAuth } from '$lib/stores/auth';
	import { isOnline, showOfflineBanner } from '$lib/stores/network';
	import { toggleTheme } from '$lib/stores/theme';

	const showAddGameModal = writable(false);
	const activeFilter = writable<string>('all');
	const sortBy = writable<string>('created_at_desc');
	let showShortcutsHelp = false;
	let mobileSidebarOpen = false;

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

	function handleKeyboard(event: KeyboardEvent) {
		// Don't handle shortcuts when typing in inputs
		if (
			event.target instanceof HTMLInputElement ||
			event.target instanceof HTMLTextAreaElement ||
			event.target instanceof HTMLSelectElement
		) {
			return;
		}

		// Esc - Close modals
		if (event.key === 'Escape') {
			if (showShortcutsHelp) {
				showShortcutsHelp = false;
			} else if ($showAddGameModal) {
				showAddGameModal.set(false);
			}
			return;
		}

		// N - New game
		if (event.key === 'n' || event.key === 'N') {
			if (!$showAddGameModal && !showShortcutsHelp && $authStore.user) {
				showAddGameModal.set(true);
			}
			return;
		}

		// ? - Show shortcuts help
		if (event.key === '?') {
			showShortcutsHelp = !showShortcutsHelp;
			return;
		}

		// T - Toggle theme
		if (event.key === 't' || event.key === 'T') {
			toggleTheme();
			return;
		}

		// 1-5 - Filter shortcuts
		if (['1', '2', '3', '4', '5'].includes(event.key)) {
			const filters = ['all', 'playing', 'backlog', 'finished', 'abandoned'];
			const index = parseInt(event.key) - 1;
			if (index >= 0 && index < filters.length && $authStore.user) {
				activeFilter.set(filters[index]);
			}
			return;
		}
	}

	onMount(() => {
		initAuth();
		registerServiceWorker();

		window.addEventListener('keydown', handleKeyboard);

		return () => {
			window.removeEventListener('keydown', handleKeyboard);
		};
	});
</script>

{#if $authStore.loading}
	<div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
		<p class="text-gray-600 dark:text-gray-400 text-lg">Loading...</p>
	</div>
{:else if !$authStore.user}
	<Auth />
{:else}
	<!-- Offline Banner -->
	{#if $showOfflineBanner}
		<div
			class="fixed top-0 left-0 right-0 bg-yellow-100 dark:bg-yellow-900/90 border-b border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-200 px-4 py-2 text-center text-sm z-50 backdrop-blur-sm"
		>
			📡 You're offline. Changes will sync when you reconnect.
		</div>
	{/if}

	<div class="flex h-screen bg-gray-50 dark:bg-gray-900" class:pt-10={$showOfflineBanner}>
		<Sidebar
			onAddGame={openAddGameModal}
			onFilterChange={handleFilterChange}
			activeFilter={$activeFilter}
			mobileOpen={mobileSidebarOpen}
			onMobileClose={() => (mobileSidebarOpen = false)}
			onDataImported={handleGameAdded}
		/>
		<div class="flex-1 flex flex-col min-w-0 overflow-hidden">
			<!-- Mobile header -->
			<header class="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 safe-top">
				<button
					on:click={() => (mobileSidebarOpen = true)}
					class="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
					aria-label="Open menu"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
				</button>
				<span class="font-bold text-gray-900 dark:text-white">GameTracker</span>
				<button
					on:click={openAddGameModal}
					class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
				>
					+ Add
				</button>
			</header>
			<main class="flex-1 overflow-y-auto">
				<slot />
			</main>
		</div>
	</div>

	<AddGameModal
		open={$showAddGameModal}
		onClose={closeAddGameModal}
		onGameAdded={handleGameAdded}
	/>

	<KeyboardShortcutsHelp open={showShortcutsHelp} onClose={() => (showShortcutsHelp = false)} />
{/if}
