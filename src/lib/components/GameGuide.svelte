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
			if (parsed.hostname.includes('youtube.com')) {
				if (parsed.searchParams.has('v')) return parsed.searchParams.get('v');
				const match = parsed.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/);
				if (match) return match[1];
			}
			if (parsed.hostname === 'youtu.be') {
				return parsed.pathname.slice(1) || null;
			}
		} catch (_) {
			// not a valid URL
		}
		return null;
	}

	// Watch position is kept in the link's `t` parameter, so "Continue" opens YouTube right there.
	// YouTube writes it as "754", "754s" or "12m34s".
	function getVideoSeconds(url: string): number {
		try {
			const parsed = new URL(url);
			const t = parsed.searchParams.get('t') ?? parsed.searchParams.get('start');
			if (!t) return 0;
			if (/^\d+s?$/.test(t)) return parseInt(t, 10);
			const match = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
			if (!match) return 0;
			return (Number(match[1] ?? 0) * 3600) + (Number(match[2] ?? 0) * 60) + Number(match[3] ?? 0);
		} catch (_) {
			return 0;
		}
	}

	function withVideoSeconds(url: string, seconds: number): string {
		const parsed = new URL(url);
		parsed.searchParams.delete('start');
		if (seconds > 0) parsed.searchParams.set('t', `${seconds}s`);
		else parsed.searchParams.delete('t');
		return parsed.toString();
	}

	function formatVideoTime(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = String(seconds % 60).padStart(2, '0');
		return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
	}

	// Accepts "12:34", "1:02:03", plain seconds, or a pasted YouTube "Start at" link
	function parsePositionInput(input: string): number | null {
		const value = input.trim();
		if (!value) return 0;
		if (/^https?:\/\//.test(value)) return extractYouTubeId(value) ? getVideoSeconds(value) : null;
		if (!/^\d+(:\d{1,2}){0,2}$/.test(value)) return null;
		return value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
	}

	$: youtubeId = guideUrl ? extractYouTubeId(guideUrl) : null;
	$: videoSeconds = guideUrl && youtubeId ? getVideoSeconds(guideUrl) : 0;
	$: hasGuide = guideUrl || guideText;

	let editingPosition = false;
	let positionInput = '';
	let positionError = '';

	function startEditingPosition() {
		positionInput = videoSeconds > 0 ? formatVideoTime(videoSeconds) : '';
		positionError = '';
		editingPosition = true;
	}

	async function savePosition() {
		if (!guideUrl) return;
		const seconds = parsePositionInput(positionInput);
		if (seconds === null) {
			positionError = 'Use a time like 12:34 or paste a YouTube link';
			return;
		}
		const url = withVideoSeconds(guideUrl, seconds);
		saving = true;
		positionError = '';
		try {
			const { error: updateError } = await supabase
				.from('games')
				.update({ guide_url: url })
				.eq('id', gameId);
			if (updateError) throw updateError;
			guideUrl = url;
			editingPosition = false;
			onUpdated();
		} catch (e) {
			positionError = e instanceof Error ? e.message : 'Failed to save position';
		} finally {
			saving = false;
		}
	}

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
					<div class="bg-gray-700 rounded-lg p-3 flex flex-wrap items-center gap-4">
						<a href={guideUrl} target="_blank" rel="noopener noreferrer" class="flex-shrink-0">
							<img
								src="https://i.ytimg.com/vi/{youtubeId}/mqdefault.jpg"
								alt="Guide video thumbnail"
								class="w-36 aspect-video object-cover rounded"
							/>
						</a>
						<div class="flex-1 min-w-[12rem] space-y-2">
							<a
								href={guideUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
							>
								▶ {videoSeconds > 0 ? `Continue on YouTube at ${formatVideoTime(videoSeconds)}` : 'Watch on YouTube'}
							</a>
							{#if editingPosition}
								<form on:submit|preventDefault={savePosition} class="space-y-1">
									<div class="flex items-center gap-2">
										<label for="guide-position" class="text-xs text-gray-400 whitespace-nowrap">Stopped at</label>
										<input
											id="guide-position"
											bind:value={positionInput}
											placeholder="12:34 or YouTube link"
											class="w-44 px-2 py-1 bg-gray-600 text-white rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
										/>
										<button type="submit" disabled={saving} class="text-blue-400 hover:text-blue-300 text-xs font-medium disabled:opacity-50">Save</button>
										<button type="button" on:click={() => (editingPosition = false)} class="text-gray-400 hover:text-gray-300 text-xs">Cancel</button>
									</div>
									{#if positionError}
										<p class="text-red-400 text-xs">{positionError}</p>
									{:else}
										<p class="text-gray-500 text-xs">Tip: in YouTube, Share → "Start at" gives a link with the exact second.</p>
									{/if}
								</form>
							{:else}
								<p class="text-xs text-gray-400">
									{videoSeconds > 0 ? `Stopped at ${formatVideoTime(videoSeconds)}` : 'No position saved yet'}
									· <button type="button" on:click={startEditingPosition} class="text-blue-400 hover:text-blue-300">{videoSeconds > 0 ? 'Change' : 'Save position'}</button>
								</p>
							{/if}
						</div>
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
