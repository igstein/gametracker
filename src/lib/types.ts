export type GameStatus = 'playing' | 'backlog' | 'finished' | 'abandoned';
export type GamePriority = 'must_play' | 'high' | 'medium' | 'low';
export type GameGenre =
	| 'Action'
	| 'Action RPG'
	| 'Adventure'
	| 'Card Game'
	| 'Fighting'
	| 'Horror'
	| 'JRPG'
	| 'MMORPG'
	| 'Platformer'
	| 'Puzzle'
	| 'Racing'
	| 'RPG'
	| 'Shooter'
	| 'Simulation'
	| 'Sports'
	| 'Strategy'
	| 'First Person Shooter'
	| 'Point and Click'
	| 'Stealth'
	| 'Survival'
	| 'Tactical RPG'
	| 'Visual Novel';

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
	date_added?: string;
	genre?: GameGenre[] | null;
	platform?: string[] | null;
	custom_target_hours?: number | null;
}

export interface GameNote {
	id: string;
	game_id: string;
	user_id: string;
	title?: string;
	content: string;
	created_at: string;
	updated_at: string;
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
