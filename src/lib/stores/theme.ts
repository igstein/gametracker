import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
	if (!browser) return 'dark';

	const stored = localStorage.getItem('theme');
	if (stored === 'light' || stored === 'dark') {
		return stored;
	}

	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(value: Theme) {
	if (!browser) return;

	if (value === 'dark') {
		document.documentElement.classList.add('dark');
	} else {
		document.documentElement.classList.remove('dark');
	}

	localStorage.setItem('theme', value);
}

const initialTheme = getInitialTheme();
export const theme = writable<Theme>(initialTheme);

// Apply on module load (client-side hydration)
if (browser) {
	applyTheme(initialTheme);
}

export function toggleTheme() {
	theme.update((current) => {
		const next = current === 'dark' ? 'light' : 'dark';
		applyTheme(next);
		return next;
	});
}
