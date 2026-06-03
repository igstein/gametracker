import type { Game } from '$lib/types';

export function getTargetHours(game: Game): number {
	if (game.custom_target_hours != null) return game.custom_target_hours;
	if (game.main_plus_extras_hours) return game.main_plus_extras_hours * 1.2;
	if (game.main_story_hours) return game.main_story_hours * 1.2;
	return 0;
}

export interface ScoreDebug {
	P: number;
	restFactor: number;
	progressFactor: number;
	startedFactor: number;
	shortGameFactor: number;
	recencyFactor: number;
	genreFactor: number;
	ageFactor: number;
	statusFactor: number;
	moodFactor: number;
}

export interface ScoreOptions {
	recentGenres?: string[];
	moodGenre?: string | null;
	moodDevice?: string | null;
	moodSetting?: string | null;
}

export function scoreGame(game: Game, opts: ScoreOptions = {}): { score: number; debug: ScoreDebug } {
	const { recentGenres = [], moodGenre = null, moodDevice = null, moodSetting = null } = opts;

	const target = getTargetHours(game);
	const rest = Math.max(0, target - game.played_hours);
	const progress = target > 0 ? Math.min(game.played_hours / target, 1) : 0;

	const P = { must_play: 1.7, high: 1.3, medium: 1.0, low: 0.7 }[game.priority];
	const restFactor = 1 / (rest + 1);
	const progressFactor = 1 + progress * progress * 2;
	const startedFactor = game.played_hours > 0 ? 1.8 : 1.0;
	const shortGameFactor = target > 0 ? 1 + 1 / Math.log2(target + 2) : 1.0;

	const daysSince = game.last_played
		? (Date.now() - new Date(game.last_played).getTime()) / 86_400_000
		: null;
	const recencyFactor = daysSince !== null ? Math.exp(-daysSince / 7) : 0.5;

	const genreFactor =
		recentGenres.length && game.genre?.length
			? game.genre.some((g) => recentGenres.includes(g))
				? 0.8
				: 1.2
			: 1.0;

	const backlogDays = game.date_added
		? (Date.now() - new Date(game.date_added).getTime()) / 86_400_000
		: 0;
	const ageFactor = 1 + Math.tanh(backlogDays / 365) * 0.5;

	const statusFactor = game.status === 'playing' ? 1.5 : 1.0;

	const moodGenreFactor = moodGenre
		? game.genre?.some((g) => g === moodGenre)
			? 2.0
			: 0.6
		: 1.0;
	const moodDeviceFactor = moodDevice
		? game.devices?.includes(moodDevice)
			? 1.8
			: 0.65
		: 1.0;
	const moodSettingFactor = moodSetting
		? game.setting?.some((s) => s === moodSetting)
			? 1.8
			: 0.65
		: 1.0;
	const moodFactor = moodGenreFactor * moodDeviceFactor * moodSettingFactor;

	const score =
		P *
		restFactor *
		progressFactor *
		startedFactor *
		shortGameFactor *
		recencyFactor *
		genreFactor *
		ageFactor *
		statusFactor *
		moodFactor;

	return {
		score,
		debug: {
			P,
			restFactor,
			progressFactor,
			startedFactor,
			shortGameFactor,
			recencyFactor,
			genreFactor,
			ageFactor,
			statusFactor,
			moodFactor
		}
	};
}

export function getMostRecentGenres(games: Game[]): string[] {
	const recent = games
		.filter((g) => g.last_played && g.genre?.length)
		.sort(
			(a, b) =>
				new Date(b.last_played ?? '').getTime() - new Date(a.last_played ?? '').getTime()
		)[0];
	return recent?.genre ?? [];
}
