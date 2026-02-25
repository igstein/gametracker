<script lang="ts">
	export let open = false;
	export let onClose: () => void;

	const shortcuts = [
		{ keys: ['N'], description: 'Add new game' },
		{ keys: ['?'], description: 'Show this help' },
		{ keys: ['Esc'], description: 'Close modal/dialog' },
		{ keys: ['1', '2', '3', '4', '5'], description: 'Switch filters (All, Playing, Backlog, etc.)' },
		{ keys: ['T'], description: 'Toggle theme (Light/Dark)' }
	];

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
		on:click={handleBackdropClick}
		role="button"
		tabindex="-1"
	>
		<div class="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700">
			<div class="flex justify-between items-center mb-6">
				<h2 class="text-2xl font-bold text-gray-900 dark:text-white">⌨️ Keyboard Shortcuts</h2>
				<button
					on:click={onClose}
					class="text-gray-400 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-2xl"
					aria-label="Close"
				>
					×
				</button>
			</div>

			<div class="space-y-3">
				{#each shortcuts as shortcut}
					<div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
						<span class="text-gray-700 dark:text-gray-300">{shortcut.description}</span>
						<div class="flex gap-2">
							{#each shortcut.keys as key}
								<kbd
									class="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded text-sm font-mono border border-gray-300 dark:border-gray-600"
								>
									{key}
								</kbd>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-6 text-center">
				<button
					on:click={onClose}
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
				>
					Got it
				</button>
			</div>
		</div>
	</div>
{/if}
