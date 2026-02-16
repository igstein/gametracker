import type { HLTBSearchResult } from '$lib/types';

const USER_AGENTS = [
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0'
];

function randomUserAgent(): string {
	return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Cache for discovered endpoint + auth token
let cachedSearchPath: string | null = null;
let cachedAuthToken: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function isCacheValid(): boolean {
	return cachedSearchPath !== null && cachedAuthToken !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

function invalidateCache(): void {
	cachedSearchPath = null;
	cachedAuthToken = null;
	cacheTimestamp = 0;
}

// Static fallback endpoint in case discovery fails
const FALLBACK_SEARCH_PATH = '/api/finder';

/**
 * Step 1: Fetch HLTB homepage, scan JS scripts, extract the search API path.
 * Mirrors the Python library approach: find fetch() calls with method:"POST"
 * to /api/*, which identifies the search endpoint.
 */
async function discoverSearchEndpoint(): Promise<string> {
	const headers = {
		'User-Agent': randomUserAgent(),
		Referer: 'https://howlongtobeat.com/'
	};

	const res = await fetch('https://howlongtobeat.com/', {
		headers: { ...headers, Accept: 'text/html' }
	});

	if (!res.ok) {
		throw new Error(`Failed to fetch HLTB homepage: ${res.status}`);
	}

	const html = await res.text();

	// Extract all script src URLs from the page
	const scriptMatches = html.matchAll(/<script[^>]+src="([^"]+\.js)"/g);
	const scriptUrls: string[] = [];
	for (const match of scriptMatches) {
		scriptUrls.push(match[1]);
	}

	if (scriptUrls.length === 0) {
		return FALLBACK_SEARCH_PATH;
	}

	// Regex from the Python library: find fetch("/api/...", {... method: "POST" ...})
	// This distinguishes the search POST endpoint from the GET init endpoint
	const postFetchPattern = /fetch\s*\(\s*["']\/api\/([a-zA-Z0-9_/]+)[^"']*["']\s*,\s*\{[^}]*method:\s*["']POST["'][^}]*\}/is;

	for (const scriptUrl of scriptUrls) {
		const fullUrl = scriptUrl.startsWith('http')
			? scriptUrl
			: `https://howlongtobeat.com${scriptUrl.startsWith('/') ? '' : '/'}${scriptUrl}`;

		let scriptRes: Response;
		try {
			scriptRes = await fetch(fullUrl, { headers });
		} catch {
			continue;
		}

		if (!scriptRes.ok) continue;

		const scriptText = await scriptRes.text();

		const match = postFetchPattern.exec(scriptText);
		if (match) {
			const pathSuffix = match[1];
			// Extract the base path (e.g. "finder" from "finder/v2")
			const basePath = pathSuffix.includes('/') ? pathSuffix.split('/')[0] : pathSuffix;
			return `/api/${basePath}`;
		}
	}

	return FALLBACK_SEARCH_PATH;
}

/**
 * Step 2: Get auth token from the init endpoint.
 */
async function getAuthToken(searchPath: string): Promise<string> {
	const timestamp = Date.now();
	const initUrl = `https://howlongtobeat.com${searchPath}/init?t=${timestamp}`;

	const res = await fetch(initUrl, {
		headers: {
			'User-Agent': randomUserAgent(),
			Referer: 'https://howlongtobeat.com/',
			Origin: 'https://howlongtobeat.com'
		}
	});

	if (!res.ok) {
		throw new Error(`Failed to get HLTB auth token: ${res.status}`);
	}

	const data = await res.json();

	if (!data.token || typeof data.token !== 'string') {
		throw new Error('HLTB init endpoint did not return a valid token');
	}

	return data.token;
}

/**
 * Step 3: Execute the search POST request.
 */
async function executeSearch(
	searchPath: string,
	authToken: string,
	query: string
): Promise<any[]> {
	const searchBody = {
		searchType: 'games',
		searchTerms: query.split(/\s+/),
		searchPage: 1,
		size: 20,
		searchOptions: {
			games: {
				userId: 0,
				platform: '',
				sortCategory: 'popular',
				rangeCategory: 'main',
				rangeTime: { min: 0, max: 0 },
				gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
				rangeYear: { min: '', max: '' },
				modifier: ''
			},
			users: {
				sortCategory: 'postcount'
			},
			lists: {
				sortCategory: 'follows'
			},
			filter: '',
			sort: 0,
			randomizer: 0
		},
		useCache: true
	};

	const res = await fetch(`https://howlongtobeat.com${searchPath}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': randomUserAgent(),
			Referer: 'https://howlongtobeat.com/',
			Origin: 'https://howlongtobeat.com',
			'x-auth-token': authToken
		},
		body: JSON.stringify(searchBody)
	});

	if (!res.ok) {
		throw new Error(`HLTB search request failed: ${res.status}`);
	}

	const data = await res.json();

	if (!data.data || !Array.isArray(data.data)) {
		return [];
	}

	return data.data;
}

function sanitizeString(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value.trim().substring(0, 500);
}

function sanitizeNumber(value: unknown): number {
	if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) return 0;
	// HLTB returns times in seconds; 10000 hours = 36,000,000 seconds
	return Math.max(0, Math.min(value, 36_000_000));
}

function validateAndSanitizeResult(entry: any): HLTBSearchResult | null {
	try {
		if (!entry || typeof entry !== 'object') return null;

		const id = typeof entry.game_id === 'number' ? entry.game_id : 0;
		const title = sanitizeString(entry.game_name);

		if (!title || id <= 0) return null;

		// Cover image: HLTB returns a relative path in game_image
		let imageUrl = '';
		if (typeof entry.game_image === 'string' && entry.game_image.trim()) {
			const img = entry.game_image.trim();
			imageUrl = img.startsWith('http') ? img : `https://howlongtobeat.com/games/${img}`;
		}

		// HLTB returns times in seconds
		const mainStorySeconds = sanitizeNumber(entry.comp_main);
		const mainPlusExtrasSeconds = sanitizeNumber(entry.comp_plus);
		const completionistSeconds = sanitizeNumber(entry.comp_100);

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

/**
 * Ensures we have a valid cached search path and auth token.
 * Discovers them if needed or if cache is stale.
 */
async function ensureEndpointAndToken(): Promise<{ searchPath: string; authToken: string }> {
	if (isCacheValid()) {
		return { searchPath: cachedSearchPath!, authToken: cachedAuthToken! };
	}

	const searchPath = await discoverSearchEndpoint();
	const authToken = await getAuthToken(searchPath);

	cachedSearchPath = searchPath;
	cachedAuthToken = authToken;
	cacheTimestamp = Date.now();

	return { searchPath, authToken };
}

export async function searchGames(query: string): Promise<HLTBSearchResult[]> {
	try {
		const sanitizedQuery = sanitizeString(query);

		if (!sanitizedQuery || sanitizedQuery.length < 2) {
			return [];
		}

		let { searchPath, authToken } = await ensureEndpointAndToken();

		let rawResults: any[];
		try {
			rawResults = await executeSearch(searchPath, authToken, sanitizedQuery);
		} catch {
			// If search fails, invalidate cache and retry once with fresh endpoint/token
			invalidateCache();
			({ searchPath, authToken } = await ensureEndpointAndToken());
			rawResults = await executeSearch(searchPath, authToken, sanitizedQuery);
		}

		const sanitizedResults = rawResults
			.map(validateAndSanitizeResult)
			.filter((r): r is HLTBSearchResult => r !== null)
			.slice(0, 10);

		return sanitizedResults;
	} catch (error) {
		console.error('HLTB search error:', error);
		throw new Error('Failed to search games. Please try manual entry.');
	}
}
