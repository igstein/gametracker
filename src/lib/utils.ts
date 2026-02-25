import type { Game } from '$lib/types';

export function getTargetHours(game: Game): number {
	if (game.custom_target_hours != null) return game.custom_target_hours;
	if (game.main_story_hours && game.main_plus_extras_hours) {
		return (game.main_story_hours + game.main_plus_extras_hours) / 2;
	}
	return game.main_story_hours || game.main_plus_extras_hours || 50;
}
