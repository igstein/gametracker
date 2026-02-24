import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const isOnline = writable(browser ? navigator.onLine : true);
export const showOfflineBanner = writable(false);

if (browser) {
	// Listen for online/offline events
	window.addEventListener('online', () => {
		console.log('[Network] Back online');
		isOnline.set(true);
		showOfflineBanner.set(false);
	});

	window.addEventListener('offline', () => {
		console.log('[Network] Gone offline');
		isOnline.set(false);
		showOfflineBanner.set(true);
	});

	// Initial check
	isOnline.set(navigator.onLine);
}
