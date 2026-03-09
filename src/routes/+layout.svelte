<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import AddGameModal from '$lib/components/AddGameModal.svelte';
	import Auth from '$lib/components/Auth.svelte';
	import KeyboardShortcutsHelp from '$lib/components/KeyboardShortcutsHelp.svelte';
	import PasswordResetModal from '$lib/components/PasswordResetModal.svelte';
	import { writable } from 'svelte/store';
	import { setContext, onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { requiresPasswordReset } from '$lib/stores/auth';
	import { isOnline, showOfflineBanner } from '$lib/stores/network';
	import { toggleTheme } from '$lib/stores/theme';
	import { browser } from '$app/environment';

	const showAddGameModal = writable(false);
	let defaultFilter = browser ? (localStorage.getItem('defaultFilter') || 'all') : 'all';
	const activeFilter = writable<string>(defaultFilter);
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

	function handleSetDefault(filter: string) {
		if (browser) {
			localStorage.setItem('defaultFilter', filter);
			defaultFilter = filter;
		}
	}

	async function registerServiceWorker() {
		if (!browser || !('serviceWorker' in navigator)) {
			return;
		}

		try {
			const registration = await navigator.serviceWorker.register('/service-worker.js');

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
		if (
			event.target instanceof HTMLInputElement ||
			event.target instanceof HTMLTextAreaElement ||
			event.target instanceof HTMLSelectElement
		) {
			return;
		}

		if (event.key === 'Escape') {
			if (showShortcutsHelp) {
				showShortcutsHelp = false;
			} else if ($showAddGameModal) {
				showAddGameModal.set(false);
			}
			return;
		}

		if (event.key === 'n' || event.key === 'N') {
			if (!$showAddGameModal && !showShortcutsHelp && $page.data.user) {
				showAddGameModal.set(true);
			}
			return;
		}

		if (event.key === '?') {
			showShortcutsHelp = !showShortcutsHelp;
			return;
		}

		if (event.key === 't' || event.key === 'T') {
			toggleTheme();
			return;
		}

		if (['1', '2', '3', '4', '5'].includes(event.key)) {
			const filters = ['all', 'playing', 'backlog', 'finished', 'abandoned'];
			const index = parseInt(event.key) - 1;
			if (index >= 0 && index < filters.length && $page.data.user) {
				activeFilter.set(filters[index]);
			}
			return;
		}
	}

	onMount(() => {
		// Check if we arrived via a password recovery link (hash fragment: #...&type=recovery)
		// This must happen before onAuthStateChange is registered, since the Supabase client
		// may have already processed the hash and fired PASSWORD_RECOVERY before we could listen.
		if (window.location.hash.includes('type=recovery')) {
			requiresPasswordReset.set(true);
			// Clean up the hash from the URL
			window.history.replaceState({}, '', window.location.pathname);
		}

		const {
			data: { subscription }
		} = $page.data.supabase.auth.onAuthStateChange((event: string) => {
			if (event === 'PASSWORD_RECOVERY') {
				requiresPasswordReset.set(true);
			} else if (event === 'SIGNED_OUT') {
				requiresPasswordReset.set(false);
			}
			// Reload page data so session/user update
			if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
				invalidate('supabase:auth');
			}
		});

		registerServiceWorker();
		window.addEventListener('keydown', handleKeyboard);

		return () => {
			subscription.unsubscribe();
			window.removeEventListener('keydown', handleKeyboard);
		};
	});
</script>

{#if $requiresPasswordReset}
	<PasswordResetModal />
{:else if !$page.data.user}
	<Auth />
{:else}
	<!-- Offline Banner -->
	{#if $showOfflineBanner}
		<div
			class="fixed top-0 left-0 right-0 bg-yellow-100 dark:bg-yellow-900/90 border-b border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-200 px-4 py-2 text-center text-sm z-50 backdrop-blur-sm"
		>
			You're offline. Changes will sync when you reconnect.
		</div>
	{/if}

	<div class="flex h-screen bg-gray-50 dark:bg-gray-900" class:pt-10={$showOfflineBanner}>
		<Sidebar
			onAddGame={openAddGameModal}
			onFilterChange={handleFilterChange}
			activeFilter={$activeFilter}
			{defaultFilter}
			onSetDefault={handleSetDefault}
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
			<main class="flex-1 overflow-y-auto safe-right">
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
