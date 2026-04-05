<script lang="ts">
	import { page } from '$app/stores';

	export let gameId: string;
	export let guideUrl: string | null = null;
	export let guideText: string | null = null;
	export let onUpdated: () => void = () => {};

	$: supabase = $page.data.supabase;

	let editing = false;
	let urlInput = '';
	let textInput = '';
	let saving = false;
	let error = '';

	function startEditing() {
		urlInput = guideUrl ?? '';
		textInput = guideText ?? '';
		editing = true;
	}

	function cancelEditing() {
		editing = false;
		error = '';
	}

	function extractYouTubeId(url: string): string | null {
		try {
			const parsed = new URL(url);
			if (parsed.hostname.includes('youtube.com') && parsed.searchParams.has('v')) {
				return parsed.searchParams.get('v');
			}
			if (parsed.hostname === 'youtu.be') {
				return parsed.pathname.slice(1) || null;
			}
		} catch (_) {
			// not a valid URL
		}
		return null;
	}

	$: youtubeId = guideUrl ? extractYouTubeId(guideUrl) : null;
	$: hasGuide = guideUrl || guideText;

	async function saveGuide() {
		saving = true;
		error = '';

		try {
			const { error: updateError } = await supabase
				.from('games')
				.update({
					guide_url: urlInput.trim() || null,
					guide_text: textInput.trim() || null
				})
				.eq('id', gameId);

			if (updateError) {
				console.error('Guide save error:', updateError);
				throw updateError;
			}

			guideUrl = urlInput.trim() || null;
			guideText = textInput.trim() || null;
			editing = false;
			onUpdated();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save guide';
		} finally {
			saving = false;
		}
	}
</script>

<div class="mt-8 pt-8 border-t border-gray-700">
	<div class="flex justify-between items-center mb-4">
		<h3 class="text-lg font-bold text-white">📖 Guide</h3>
		{#if !editing}
			<button
				on:click={startEditing}
				class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
			>
				{hasGuide ? 'Edit' : '+ Add Guide'}
			</button>
		{/if}
	</div>

	{#if editing}
		<div class="bg-gray-700 rounded-lg p-4 space-y-3">
			<div>
				<label for="guide-url" class="block text-sm font-medium text-gray-300 mb-1">URL (YouTube or any link)</label>
				<input
					id="guide-url"
					type="url"
					bind:value={urlInput}
					placeholder="https://youtube.com/watch?v=... or any guide link"
					class="w-full px-3 py-2 bg-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
				/>
			</div>
			<div>
				<label for="guide-text" class="block text-sm font-medium text-gray-300 mb-1">Walkthrough Text</label>
				<textarea
					id="guide-text"
					bind:value={textInput}
					placeholder="Paste a walkthrough or write your own notes..."
					rows="6"
					class="w-full px-3 py-2 bg-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
				></textarea>
			</div>
			{#if error}
				<div class="text-red-500 text-sm">{error}</div>
			{/if}
			<div class="flex gap-2">
				<button
					on:click={cancelEditing}
					disabled={saving}
					class="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					on:click={saveGuide}
					disabled={saving}
					class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	{:else if hasGuide}
		<div class="space-y-4">
			{#if guideUrl}
				{#if youtubeId}
					<div class="aspect-video rounded-lg overflow-hidden">
						<iframe
							src="https://www.youtube-nocookie.com/embed/{youtubeId}"
							title="Guide video"
							class="w-full h-full"
							frameborder="0"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowfullscreen
						></iframe>
					</div>
				{:else}
					<a
						href={guideUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-blue-400 hover:text-blue-300 text-sm rounded-lg transition-colors"
					>
						Open Guide
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
					</a>
				{/if}
			{/if}
			{#if guideText}
				<div class="bg-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
					<p class="text-gray-300 text-sm whitespace-pre-wrap">{guideText}</p>
				</div>
			{/if}
		</div>
	{:else}
		<p class="text-gray-500 text-sm text-center py-8">
			No guide added yet. Click "+ Add Guide" to link a YouTube video or paste a walkthrough.
		</p>
	{/if}
</div>
