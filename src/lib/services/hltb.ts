import { HowLongToBeat } from 'howlongtobeat-core';
import type { HLTBSearchResult } from '$lib/types';

const hltb = new HowLongToBeat({
	similarityThreshold: 0.4,
	algorithm: 'gestalt'
});

function sanitizeString(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value.trim().substring(0, 500);
}

function sanitizeNumber(value: unknown): number {
	if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) return 0;
	return Math.max(0, Math.min(value, 10000));
}

function sanitizeUrl(value: unknown): string {
	if (typeof value !== 'string') return '';
	const url = value.trim();
	if (!url.startsWith('https://howlongtobeat.com/') && !url.startsWith('https://')) {
		return '';
	}
	return url.substring(0, 500);
}

function validateAndSanitizeResult(entry: any): HLTBSearchResult | null {
	try {
		if (!entry || typeof entry !== 'object') return null;

		const id = typeof entry.id === 'number' ? entry.id : 0;
		const title = sanitizeString(entry.name || entry.title);

		if (!title || id <= 0) return null;

		const imageUrl = sanitizeUrl(entry.imageUrl || entry.image_url || '');

		const mainStorySeconds = sanitizeNumber(entry.gameplayMain || entry.comp_main || 0);
		const mainPlusExtrasSeconds = sanitizeNumber(entry.gameplayMainExtra || entry.comp_plus || 0);
		const completionistSeconds = sanitizeNumber(entry.gameplayCompletionist || entry.comp_100 || 0);

		const mainStoryHours = mainStorySeconds / 3600;
		const mainPlusExtrasHours = mainPlusExtrasSeconds / 3600;
		const completionistHours = completionistSeconds / 3600;

		const targetHours =
			mainStoryHours > 0 && mainPlusExtrasHours > 0
				? (mainStoryHours + mainPlusExtrasHours) / 2
				: mainStoryHours > 0
					? mainStoryHours
					: mainPlusExtrasHours > 0
						? mainPlusExtrasHours
						: 50;

		return {
			id,
			title,
			imageUrl,
			mainStoryHours: Math.round(mainStoryHours * 10) / 10,
			mainPlusExtrasHours: Math.round(mainPlusExtrasHours * 10) / 10,
			completionistHours: Math.round(completionistHours * 10) / 10,
			targetHours: Math.round(targetHours * 10) / 10
		};
	} catch (error) {
		console.error('Error validating HLTB result:', error);
		return null;
	}
}

export async function searchGames(query: string): Promise<HLTBSearchResult[]> {
	try {
		const sanitizedQuery = sanitizeString(query);

		if (!sanitizedQuery || sanitizedQuery.length < 2) {
			return [];
		}

		const results = await hltb.search(sanitizedQuery);

		if (!Array.isArray(results)) {
			console.error('HLTB returned non-array results');
			return [];
		}

		const sanitizedResults = results
			.map(validateAndSanitizeResult)
			.filter((r): r is HLTBSearchResult => r !== null)
			.slice(0, 10);

		return sanitizedResults;
	} catch (error) {
		console.error('HLTB search error:', error);
		throw new Error('Failed to search games. Please try manual entry.');
	}
}
