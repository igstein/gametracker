<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import { theme, toggleTheme } from '$lib/stores/theme';
	import { supabase } from '$lib/supabase/client';

	export let onAddGame: () => void;
	export let onFilterChange: (filter: string) => void;
	export let activeFilter: string = 'all';
	export let mobileOpen: boolean = false;
	export let onMobileClose: () => void = () => {};
	export let onDataImported: () => void = () => {};

	const filters = [
		{ id: 'all', label: 'All', icon: '🎮' },
		{ id: 'playing', label: 'Playing', icon: '▶' },
		{ id: 'backlog', label: 'Backlog', icon: '📋' },
		{ id: 'finished', label: 'Finished', icon: '✅' },
		{ id: 'abandoned', label: 'Abandoned', icon: '❌' }
	];

	let importInput: HTMLInputElement;
	let importError = '';
	let importSuccess = '';
	let exporting = false;
	let importing = false;

	function setFilter(filterId: string) {
		onFilterChange(filterId);
		onMobileClose();
	}

	async function handleSignOut() {
		await authStore.signOut();
	}

	async function handleExport() {
		if (!$authStore.user) return;
		exporting = true;
		try {
			const [gamesRes, notesRes] = await Promise.all([
				supabase.from('games').select('*').eq('user_id', $authStore.user.id),
				supabase.from('game_notes').select('*').eq('user_id', $authStore.user.id)
			]);

			if (gamesRes.error) throw gamesRes.error;
			if (notesRes.error) throw notesRes.error;

			const payload = {
				version: 1,
				exportedAt: new Date().toISOString(),
				games: gamesRes.data ?? [],
				notes: notesRes.data ?? []
			};

			const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `gametracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			console.error('Export failed:', e);
		} finally {
			exporting = false;
		}
	}

	function handleImportClick() {
		importError = '';
		importSuccess = '';
		importInput.click();
	}

	async function handleImportFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file || !$authStore.user) return;

		importing = true;
		importError = '';
		importSuccess = '';

		try {
			const text = await file.text();
			const data = JSON.parse(text);

			if (!data.games || !Array.isArray(data.games)) {
				throw new Error('Invalid backup file: missing games array');
			}

			const userId = $authStore.user.id;

			// Upsert games with current user_id
			if (data.games.length > 0) {
				const games = data.games.map((g: Record<string, unknown>) => ({ ...g, user_id: userId }));
				const { error } = await supabase.from('games').upsert(games, { onConflict: 'id' });
				if (error) throw error;
			}

			// Upsert notes with current user_id
			if (data.notes?.length > 0) {
				const notes = data.notes.map((n: Record<string, unknown>) => ({ ...n, user_id: userId }));
				const { error } = await supabase.from('game_notes').upsert(notes, { onConflict: 'id' });
				if (error) throw error;
			}

			importSuccess = `Imported ${data.games.length} game${data.games.length !== 1 ? 's' : ''}`;
			onDataImported();
		} catch (e) {
			importError = e instanceof SyntaxError ? 'Invalid JSON file' : String(e instanceof Error ? e.message : e);
		} finally {
			importing = false;
			// Reset input so the same file can be re-imported
			importInput.value = '';
		}
	}
</script>

<!-- Mobile backdrop -->
{#if mobileOpen}
	<div
		class="fixed inset-0 bg-black/50 z-30 md:hidden"
		on:click={onMobileClose}
		role="button"
		tabindex="-1"
		aria-label="Close menu"
	></div>
{/if}

<aside
	class="
		fixed inset-y-0 left-0 z-40 w-64 flex flex-col
		bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
		transition-transform duration-200
		{mobileOpen ? 'translate-x-0' : '-translate-x-full'}
		md:translate-x-0 md:static md:z-auto md:transition-none
	"
>
	<div class="p-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">GameTracker</h1>
		<button
			class="md:hidden text-gray-500 hover:text-gray-900 dark:hover:text-white text-2xl leading-none"
			on:click={onMobileClose}
			aria-label="Close menu"
		>×</button>
	</div>

	<nav class="flex-1 px-4 overflow-y-auto">
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

		<!-- Backup -->
		<div class="flex gap-2">
			<button
				on:click={handleExport}
				disabled={exporting}
				title="Export all games to JSON"
				class="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded-lg transition-colors disabled:opacity-50"
			>
				{exporting ? 'Exporting…' : '↓ Export'}
			</button>
			<button
				on:click={handleImportClick}
				disabled={importing}
				title="Import games from JSON backup"
				class="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded-lg transition-colors disabled:opacity-50"
			>
				{importing ? 'Importing…' : '↑ Import'}
			</button>
		</div>

		{#if importError}
			<p class="text-red-600 dark:text-red-400 text-xs px-1">{importError}</p>
		{/if}
		{#if importSuccess}
			<p class="text-green-600 dark:text-green-400 text-xs px-1">{importSuccess}</p>
		{/if}

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

<!-- Hidden file input for import -->
<input
	bind:this={importInput}
	type="file"
	accept=".json,application/json"
	class="hidden"
	on:change={handleImportFile}
/>
