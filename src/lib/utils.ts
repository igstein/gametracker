import type { Game } from '$lib/types';

export function getTargetHours(game: Game): number {
	if (game.custom_target_hours != null) return game.custom_target_hours;
	if (game.main_plus_extras_hours) {
		return game.main_plus_extras_hours * 1.10;
	}
	if (game.main_story_hours) {
		return game.main_story_hours * 1.10;
	}
	return 0;
}
