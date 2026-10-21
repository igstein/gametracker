<script lang="ts">
	import type { Game } from '$lib/types';

	export let games: Game[] = [];
	export let onOpenGame: (game: Game) => void;

	const MONTHS_SHOWN = 12;

	$: library = games.filter((g) => g.status !== 'wishlist');
	$: finished = games.filter((g) => g.status === 'finished');
	$: rated = finished.filter((g) => g.rating);

	$: totalHours = library.reduce((sum, g) => sum + g.played_hours, 0);
	$: averageRating = rated.length
		? rated.reduce((sum, g) => sum + (g.rating ?? 0), 0) / rated.length
		: null;

	// Same fallback as the Hall of Fame: games finished before finished_at existed use last_played
	function finishedDate(game: Game): Date | null {
		const date = game.finished_at ?? game.last_played;
		return date ? new Date(date) : null;
	}

	function monthKey(date: Date): string {
		return `${date.getFullYear()}-${date.getMonth()}`;
	}

	$: months = (() => {
		const now = new Date();
		const buckets = Array.from({ length: MONTHS_SHOWN }, (_, i) => {
			const date = new Date(now.getFullYear(), now.getMonth() - (MONTHS_SHOWN - 1 - i), 1);
			return { key: monthKey(date), date, games: [] as Game[] };
		});
		const byKey = new Map(buckets.map((b) => [b.key, b]));
		for (const game of finished) {
			const date = finishedDate(game);
			if (date) byKey.get(monthKey(date))?.games.push(game);
		}
		return buckets;
	})();
	$: maxPerMonth = Math.max(1, ...months.map((m) => m.games.length));

	$: finishedPerYear = (() => {
		const counts = new Map<number, number>();
		for (const game of finished) {
			const date = finishedDate(game);
			if (date) counts.set(date.getFullYear(), (counts.get(date.getFullYear()) ?? 0) + 1);
		}
		return [...counts.entries()].sort((a, b) => b[0] - a[0]);
	})();

	$: ratingCounts = Array.from({ length: 10 }, (_, i) => {
		const rating = 10 - i;
		return { rating, games: rated.filter((g) => g.rating === rating) };
	});
	$: maxPerRating = Math.max(1, ...ratingCounts.map((r) => r.games.length));

	// Finished games compared against HLTB Main + Extras (or Main Story when that's all there is)
	$: hltbRows = finished
		.map((game) => {
			const hltbHours = game.main_plus_extras_hours ?? game.main_story_hours ?? 0;
			const basis = game.main_plus_extras_hours ? 'Main + Extras' : 'Main Story';
			return { game, hltbHours, basis, ratio: hltbHours > 0 ? game.played_hours / hltbHours : 0 };
		})
		.filter((row) => row.hltbHours > 0)
		.sort((a, b) => (finishedDate(b.game)?.getTime() ?? 0) - (finishedDate(a.game)?.getTime() ?? 0));
	$: hltbPlayed = hltbRows.reduce((sum, r) => sum + r.game.played_hours, 0);
	$: hltbTotal = hltbRows.reduce((sum, r) => sum + r.hltbHours, 0);

	function formatHours(hours: number): string {
		return `${(Math.round(hours * 10) / 10).toLocaleString()}h`;
	}

	function formatMonth(date: Date): string {
		return date.toLocaleDateString(undefined, { month: 'short' });
	}

	function formatPercent(ratio: number): string {
		return `${Math.round(ratio * 100)}%`;
	}
</script>

<div class="mb-8">
	<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">📊 Stats</h2>
	<p class="text-gray-600 dark:text-gray-400">Your gaming history in numbers</p>
</div>

{#if library.length === 0}
	<div class="text-center py-20 text-gray-500">
		<p class="text-lg">No games yet. Stats will appear once you add some.</p>
	</div>
{:else}
	<div class="space-y-10 max-w-4xl">
		<!-- Summary tiles -->
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
			{#each [
				{ label: 'Hours played', value: formatHours(totalHours), sub: `across ${library.length} game${library.length === 1 ? '' : 's'}` },
				{ label: 'Games finished', value: String(finished.length), sub: `${formatHours(finished.reduce((s, g) => s + g.played_hours, 0))} in finished games` },
				{ label: 'Average rating', value: averageRating !== null ? `${averageRating.toFixed(1)} ★` : '—', sub: `${rated.length} rated game${rated.length === 1 ? '' : 's'}` },
				{ label: 'vs. HLTB', value: hltbTotal > 0 ? formatPercent(hltbPlayed / hltbTotal) : '—', sub: hltbTotal > 0 ? 'of HLTB time in finished games' : 'no finished games with HLTB data' }
			] as tile}
				<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
					<p class="text-xs font-medium text-gray-500 dark:text-gray-400">{tile.label}</p>
					<p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{tile.value}</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">{tile.sub}</p>
				</div>
			{/each}
		</div>

		<!-- Finished per month -->
		<section>
			<h3 class="text-lg font-bold text-gray-900 dark:text-white mb-1">Games finished per month</h3>
			<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
				Last {MONTHS_SHOWN} months{#if finishedPerYear.length > 0}{' · '}{#each finishedPerYear as [year, count], i}{i > 0 ? ', ' : ''}{year}: {count}{/each}{/if}
			</p>
			<div class="overflow-x-auto">
				<div class="flex items-end gap-0.5 h-40 min-w-[320px] border-b border-gray-200 dark:border-gray-700">
					{#each months as month (month.key)}
						<div
							class="group relative flex-1 h-full flex flex-col justify-end items-center"
							title="{month.date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}: {month.games.length} finished{month.games.length ? '\n' + month.games.map((g) => g.title).join('\n') : ''}"
						>
							{#if month.games.length > 0}
								<span class="text-xs text-gray-600 dark:text-gray-300 tabular-nums mb-1">{month.games.length}</span>
								<div
									class="w-3/5 max-w-8 bg-blue-500 dark:bg-blue-400 rounded-t group-hover:bg-blue-600 dark:group-hover:bg-blue-300 transition-colors"
									style="height: {(month.games.length / maxPerMonth) * 80}%"
								></div>
							{/if}
						</div>
					{/each}
				</div>
				<div class="flex gap-0.5 min-w-[320px] mt-1">
					{#each months as month (month.key)}
						<span class="flex-1 text-center text-[10px] text-gray-500 dark:text-gray-400">{formatMonth(month.date)}</span>
					{/each}
				</div>
			</div>
		</section>

		<!-- Ratings -->
		<section>
			<h3 class="text-lg font-bold text-gray-900 dark:text-white mb-1">Your ratings</h3>
			{#if rated.length === 0}
				<p class="text-sm text-gray-500 dark:text-gray-400">No rated games yet. Rate a finished game in the Hall of Fame.</p>
			{:else}
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{rated.length} rated game{rated.length === 1 ? '' : 's'}</p>
				<ul class="space-y-1 max-w-xl">
					{#each ratingCounts as row (row.rating)}
						<li
							class="flex items-center gap-3 text-sm"
							title={row.games.map((g) => g.title).join('\n')}
						>
							<span class="w-10 text-right text-gray-600 dark:text-gray-300 tabular-nums flex-shrink-0">{row.rating} ★</span>
							<div class="flex-1 h-3">
								{#if row.games.length > 0}
									<div
										class="h-full bg-yellow-400 rounded-r"
										style="width: {(row.games.length / maxPerRating) * 100}%"
									></div>
								{/if}
							</div>
							<span class="w-6 text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">{row.games.length || ''}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Played vs HLTB -->
		<section>
			<h3 class="text-lg font-bold text-gray-900 dark:text-white mb-1">Your time vs. HLTB</h3>
			{#if hltbRows.length === 0}
				<p class="text-sm text-gray-500 dark:text-gray-400">No finished games with HLTB times yet.</p>
			{:else}
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
					{hltbRows.length} finished game{hltbRows.length === 1 ? '' : 's'}: you played {formatHours(hltbPlayed)}, HLTB lists {formatHours(hltbTotal)}
				</p>
				<div class="overflow-x-auto">
					<table class="w-full text-sm min-w-[360px]">
						<thead>
							<tr class="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
								<th class="py-2 pr-3 font-medium">Game</th>
								<th class="py-2 px-3 font-medium text-right">You</th>
								<th class="py-2 px-3 font-medium text-right">HLTB</th>
								<th class="py-2 pl-3 font-medium text-right">You / HLTB</th>
							</tr>
						</thead>
						<tbody>
							{#each hltbRows as row (row.game.id)}
								<tr class="border-b border-gray-100 dark:border-gray-800">
									<td class="py-2 pr-3">
										<button
											type="button"
											on:click={() => onOpenGame(row.game)}
											class="text-gray-900 dark:text-white hover:underline text-left"
										>
											{row.game.title}
										</button>
									</td>
									<td class="py-2 px-3 text-right tabular-nums text-gray-900 dark:text-white">{formatHours(row.game.played_hours)}</td>
									<td class="py-2 px-3 text-right tabular-nums text-gray-600 dark:text-gray-300" title={row.basis}>
										{formatHours(row.hltbHours)}{#if row.basis === 'Main Story'}<span class="ml-1 text-[10px] text-gray-400">main</span>{/if}
									</td>
									<td class="py-2 pl-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatPercent(row.ratio)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">HLTB time is Main + Extras, or Main Story where that's all HLTB has.</p>
			{/if}
		</section>
	</div>
{/if}
