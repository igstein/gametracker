export type GameStatus = 'playing' | 'backlog' | 'finished' | 'abandoned';
export type GamePriority = 'must_play' | 'high' | 'medium' | 'low';

export interface Game {
	id: string;
	title: string;
	hltb_id?: number;
	cover_image_url?: string;
	played_hours: number;
	main_story_hours?: number;
	main_plus_extras_hours?: number;
	completionist_hours?: number;
	status: GameStatus;
	priority: GamePriority;
	last_played?: string;
}

export interface HLTBSearchResult {
	id: number;
	title: string;
	imageUrl: string;
	mainStoryHours: number;
	mainPlusExtrasHours: number;
	completionistHours: number;
	targetHours: number;
}
