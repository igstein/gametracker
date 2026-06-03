import type { GamePriority, GameStatus } from '$lib/types';

export interface PriorityConfig {
	icon: string;
	label: string;
	tailwindColor: string;
	hexColor: string;
}

export const PRIORITY_CONFIG: Record<GamePriority, PriorityConfig> = {
	must_play: { icon: '★', label: 'Must Play', tailwindColor: 'text-yellow-400', hexColor: '#FFD700' },
	high: { icon: '●', label: 'High', tailwindColor: 'text-gray-400', hexColor: '#A0AEC0' },
	medium: { icon: '●', label: 'Medium', tailwindColor: 'text-amber-600', hexColor: '#CD7F32' },
	low: { icon: '○', label: 'Low', tailwindColor: 'text-gray-600', hexColor: '#9CA3AF' }
};

export interface StatusConfig {
	icon: string;
	label: string;
}

export const STATUS_CONFIG: Record<GameStatus, StatusConfig> = {
	playing: { icon: '▶', label: 'Playing' },
	backlog: { icon: '📋', label: 'Backlog' },
	finished: { icon: '✅', label: 'Finished' },
	abandoned: { icon: '❌', label: 'Abandoned' },
	wishlist: { icon: '💫', label: 'Wishlist' }
};

export const PRIORITY_ORDER: Record<GamePriority, number> = {
	must_play: 0,
	high: 1,
	medium: 2,
	low: 3
};
