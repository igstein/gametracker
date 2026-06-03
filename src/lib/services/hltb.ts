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

const KNOWN_SEARCH_ENDPOINTS = ['/api/find', '/api/search'];
const FALLBACK_SEARCH_PATH = '/api/find';
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes — HLTB tokens are short-lived

/**
 * A session holds one User-Agent + endpoint + auth token. HLTB binds tokens to the
 * UA that requested them, so all three steps (discover/auth/search) must use the
 * same UA, and cached tokens must reuse their original UA.
 */
interface Session {
	searchPath: string;
	authToken: string;
	hpKey: string;
	hpVal: string;
	userAgent: string;
	createdAt: number;
}

let cachedSession: Session | null = null;

function isSessionValid(s: Session | null): s is Session {
	return s !== null && Date.now() - s.createdAt < SESSION_TTL_MS;
}

async function discoverSearchEndpoint(userAgent: string): Promise<string> {
	const headers = {
		'User-Agent': userAgent,
		Referer: 'https://howlongtobeat.com/'
	};

	const res = await fetch('https://howlongtobeat.com/', {
		headers: { ...headers, Accept: 'text/html' }
	});

	if (!res.ok) {
		throw new Error(`Failed to fetch HLTB homepage: ${res.status}`);
	}

	const html = await res.text();
	const scriptMatches = html.matchAll(/<script[^>]+src="([^"]+\.js)"/g);
	const scriptUrls: string[] = [];
	for (const match of scriptMatches) {
		scriptUrls.push(match[1]);
	}

	if (scriptUrls.length === 0) return FALLBACK_SEARCH_PATH;

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

		const knownMatch = /["'`]\/api\/(find|search)(?:\/[a-zA-Z0-9_/]*)?["'`]/i.exec(scriptText);
		if (knownMatch) return `/api/${knownMatch[1]}`;

		const fetchMatch = /fetch\s*\(\s*["'`]\/api\/([a-zA-Z][a-zA-Z0-9_]*)["'`]/i.exec(scriptText);
		if (fetchMatch) {
			const path = fetchMatch[1];
			const nonSearch = ['user', 'auth', 'login', 'profile', 'settings', 'upload'];
			if (!nonSearch.includes(path)) return `/api/${path}`;
		}
	}

	return FALLBACK_SEARCH_PATH;
}

async function getAuthData(
	searchPath: string,
	userAgent: string
): Promise<{ token: string; hpKey: string; hpVal: string }> {
	const initUrl = `https://howlongtobeat.com${searchPath}/init?t=${Date.now()}`;

	const res = await fetch(initUrl, {
		headers: {
			'User-Agent': userAgent,
			Referer: 'https://howlongtobeat.com/',
			Origin: 'https://howlongtobeat.com'
		}
	});

	if (!res.ok) throw new Error(`HLTB init failed: ${res.status}`);

	const data = await res.json();
	if (!data.token || typeof data.token !== 'string') {
		throw new Error('HLTB init returned no token');
	}

	return { token: data.token, hpKey: data.hpKey ?? '', hpVal: data.hpVal ?? '' };
}

async function executeSearch(session: Session, query: string): Promise<any[]> {
	const searchBody: Record<string, any> = {
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
			users: { sortCategory: 'postcount' },
			lists: { sortCategory: 'follows' },
			filter: '',
			sort: 0,
			randomizer: 0
		},
		useCache: true
	};

	if (session.hpKey) searchBody[session.hpKey] = session.hpVal;

	const res = await fetch(`https://howlongtobeat.com${session.searchPath}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': session.userAgent,
			Referer: 'https://howlongtobeat.com/',
			Origin: 'https://howlongtobeat.com',
			'x-auth-token': session.authToken,
			'x-hp-key': session.hpKey,
			'x-hp-val': session.hpVal
		},
		body: JSON.stringify(searchBody)
	});

	if (!res.ok) {
		throw new Error(`HLTB search HTTP ${res.status}`);
	}

	const data = await res.json();
	return Array.isArray(data.data) ? data.data : [];
}

async function newSession(forcedPath?: string): Promise<Session> {
	const userAgent = randomUserAgent();
	const searchPath = forcedPath ?? (await discoverSearchEndpoint(userAgent));
	const { token, hpKey, hpVal } = await getAuthData(searchPath, userAgent);
	return {
		searchPath,
		authToken: token,
		hpKey,
		hpVal,
		userAgent,
		createdAt: Date.now()
	};
}

function sanitizeString(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value.trim().substring(0, 500);
}

function sanitizeNumber(value: unknown): number {
	if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) return 0;
	return Math.max(0, Math.min(value, 36_000_000));
}

function validateAndSanitizeResult(entry: any): HLTBSearchResult | null {
	try {
		if (!entry || typeof entry !== 'object') return null;
		const id = typeof entry.game_id === 'number' ? entry.game_id : 0;
		const title = sanitizeString(entry.game_name);
		if (!title || id <= 0) return null;

		let imageUrl = '';
		if (typeof entry.game_image === 'string' && entry.game_image.trim()) {
			const img = entry.game_image.trim();
			imageUrl = img.startsWith('http') ? img : `https://howlongtobeat.com/games/${img}`;
		}

		const mainStoryHours = sanitizeNumber(entry.comp_main) / 3600;
		const mainPlusExtrasHours = sanitizeNumber(entry.comp_plus) / 3600;
		const completionistHours = sanitizeNumber(entry.comp_100) / 3600;

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

async function trySearch(session: Session, query: string): Promise<HLTBSearchResult[]> {
	const rawResults = await executeSearch(session, query);
	return rawResults
		.map(validateAndSanitizeResult)
		.filter((r): r is HLTBSearchResult => r !== null)
		.slice(0, 10);
}

export async function searchGames(query: string): Promise<HLTBSearchResult[]> {
	const sanitizedQuery = sanitizeString(query);
	if (!sanitizedQuery || sanitizedQuery.length < 2) return [];

	const errors: string[] = [];

	// Attempt 1: cached session (if still fresh)
	if (isSessionValid(cachedSession)) {
		try {
			return await trySearch(cachedSession, sanitizedQuery);
		} catch (e) {
			errors.push(`cached: ${e instanceof Error ? e.message : 'unknown'}`);
			cachedSession = null;
		}
	}

	// Attempt 2: fresh session via endpoint discovery
	try {
		cachedSession = await newSession();
		return await trySearch(cachedSession, sanitizedQuery);
	} catch (e) {
		errors.push(`fresh: ${e instanceof Error ? e.message : 'unknown'}`);
		cachedSession = null;
	}

	// Attempt 3: try each known endpoint with its own fresh session
	for (const path of KNOWN_SEARCH_ENDPOINTS) {
		try {
			await new Promise((resolve) => setTimeout(resolve, 400));
			const session = await newSession(path);
			const results = await trySearch(session, sanitizedQuery);
			cachedSession = session;
			return results;
		} catch (e) {
			errors.push(`${path}: ${e instanceof Error ? e.message : 'unknown'}`);
		}
	}

	console.error('HLTB search failed after all attempts:', errors.join(' | '));
	throw new Error('Search temporarily unavailable. Please try again or add manually.');
}
