import type { Game } from '$lib/types';

export function scoreGame(game: Game, recentGenres: string[] = []): number {
	const targetHours = getTargetHours(game);
	const rest = Math.max(0, targetHours - game.played_hours);

	// P: Priority
	const P = { must_play: 1.7, high: 1.3, medium: 1.0, low: 0.7 }[game.priority];

	// 1/(rest+1): Boosts games close to completion
	const restFactor = 1 / (rest + 1);

	// exp(-days/7): Recency decay; 1.0 if never played
	let recencyFactor = 1.0;
	if (game.last_played) {
		const daysSince = (Date.now() - new Date(game.last_played).getTime()) / 86_400_000;
		recencyFactor = Math.exp(-daysSince / 7);
	}

	// D_Genre: 0.8 if shares any genre with most recently played game, 1.2 if different, 1.0 if no data
	let genreFactor = 1.0;
	if (recentGenres.length && game.genre?.length) {
		genreFactor = game.genre.some((g) => recentGenres.includes(g)) ? 0.8 : 1.2;
	}

	// A_Age: Older backlog games get a gentle boost (saturates at ~1.5)
	let ageFactor = 1.0;
	if (game.date_added) {
		const backlogDays = (Date.now() - new Date(game.date_added).getTime()) / 86_400_000;
		ageFactor = 1 + Math.tanh(backlogDays / 365) * 0.5;
	}

	// S_Status: Playing games get a strong nudge over backlog
	const statusFactor = game.status === 'playing' ? 1.5 : 1.0;

	return P * restFactor * recencyFactor * genreFactor * ageFactor * statusFactor;
}

export function getTargetHours(game: Game): number {
	if (game.custom_target_hours != null) return game.custom_target_hours;
	if (game.main_plus_extras_hours) {
		return game.main_plus_extras_hours * 1.20;
	}
	if (game.main_story_hours) {
		return game.main_story_hours * 1.20;
	}
	return 0;
}
