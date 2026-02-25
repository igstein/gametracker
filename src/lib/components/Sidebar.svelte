<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import { theme, toggleTheme } from '$lib/stores/theme';

	export let onAddGame: () => void;
	export let onFilterChange: (filter: string) => void;
	export let activeFilter: string = 'all';

	const filters = [
		{ id: 'all', label: 'All', icon: '🎮' },
		{ id: 'playing', label: 'Playing', icon: '▶' },
		{ id: 'backlog', label: 'Backlog', icon: '📋' },
		{ id: 'finished', label: 'Finished', icon: '✅' },
		{ id: 'abandoned', label: 'Abandoned', icon: '❌' }
	];

	function setFilter(filterId: string) {
		onFilterChange(filterId);
	}

	async function handleSignOut() {
		await authStore.signOut();
	}
</script>

<aside class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
	<div class="p-6">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">GameTracker</h1>
	</div>

	<nav class="flex-1 px-4">
		<ul class="space-y-2">
			{#each filters as filter}
				<li>
					<button
						on:click={() => setFilter(filter.id)}
						class="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors {activeFilter ===
						filter.id
							? 'bg-blue-600 text-white'
							: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
					>
						<span class="text-lg">{filter.icon}</span>
						<span class="font-medium">{filter.label}</span>
					</button>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="p-4 space-y-2">
		<button
			on:click={onAddGame}
			class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
		>
			+ Add Game
		</button>

		<!-- Theme Toggle -->
		<button
			on:click={toggleTheme}
			class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
			title="Toggle theme"
		>
			{#if $theme === 'dark'}
				<span>☀️</span>
				<span>Light Mode</span>
			{:else}
				<span>🌙</span>
				<span>Dark Mode</span>
			{/if}
		</button>

		<button
			on:click={handleSignOut}
			class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors"
		>
			Sign Out
		</button>
		{#if $authStore.user?.email}
			<p class="text-gray-500 dark:text-gray-500 text-xs text-center truncate px-2">{$authStore.user.email}</p>
		{/if}
	</div>
</aside>
