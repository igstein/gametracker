<script lang="ts">
	import type { Game } from '$lib/types';

	export let game: Game;

	// Calculate target hours (average of main story and main + extras)
	const targetHours =
		game.main_story_hours && game.main_plus_extras_hours
			? (game.main_story_hours + game.main_plus_extras_hours) / 2
			: 50; // Default fallback

	// Calculate progress percentage
	const progress = Math.min(100, (game.played_hours / targetHours) * 100);

	// Determine progress bar color
	let progressColor = '';
	if (progress < 30) {
		progressColor = 'bg-red-500';
	} else if (progress < 70) {
		progressColor = 'bg-yellow-500';
	} else {
		progressColor = 'bg-green-500';
	}

	// Priority icon and color
	const priorityConfig = {
		must_play: { icon: '★', color: 'text-yellow-400' },
		high: { icon: '●', color: 'text-gray-400' },
		medium: { icon: '●', color: 'text-amber-600' },
		low: { icon: '○', color: 'text-gray-600' }
	};

	const priority = priorityConfig[game.priority];
</script>

<div class="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors cursor-pointer">
	<!-- Cover Image -->
	<div class="aspect-[3/4] bg-gray-700 flex items-center justify-center">
		{#if game.cover_image_url}
			<img src={game.cover_image_url} alt={game.title} class="w-full h-full object-cover" />
		{:else}
			<span class="text-6xl">🎮</span>
		{/if}
	</div>

	<!-- Game Info -->
	<div class="p-4">
		<div class="flex items-start justify-between gap-2 mb-3">
			<h3 class="font-semibold text-white text-sm line-clamp-2 flex-1">{game.title}</h3>
			<span class="text-xl {priority.color} flex-shrink-0">{priority.icon}</span>
		</div>

		<!-- Progress Bar -->
		<div class="space-y-2">
			<div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
				<div class="{progressColor} h-full transition-all" style="width: {progress}%"></div>
			</div>
			<div class="flex justify-between text-xs text-gray-400">
				<span>{game.played_hours}h / {targetHours.toFixed(0)}h</span>
				<span>{progress.toFixed(0)}%</span>
			</div>
		</div>
	</div>
</div>
