// IndexedDB wrapper for offline data storage

import type { Game, GameNote } from '$lib/types';

const DB_NAME = 'gametracker-db';
const DB_VERSION = 1;

// Store names
const GAMES_STORE = 'games';
const NOTES_STORE = 'game_notes';
const SYNC_QUEUE_STORE = 'sync_queue';

// Sync queue entry
export interface SyncQueueItem {
	id: string;
	operation: 'insert' | 'update' | 'delete';
	table: 'games' | 'game_notes';
	data: any;
	timestamp: number;
}

let db: IDBDatabase | null = null;

// Initialize IndexedDB
export async function initDB(): Promise<IDBDatabase> {
	if (db) return db;

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			db = request.result;
			resolve(db);
		};

		request.onupgradeneeded = (event) => {
			const database = (event.target as IDBOpenDBRequest).result;

			// Games store
			if (!database.objectStoreNames.contains(GAMES_STORE)) {
				const gamesStore = database.createObjectStore(GAMES_STORE, { keyPath: 'id' });
				gamesStore.createIndex('user_id', 'user_id', { unique: false });
			}

			// Game notes store
			if (!database.objectStoreNames.contains(NOTES_STORE)) {
				const notesStore = database.createObjectStore(NOTES_STORE, { keyPath: 'id' });
				notesStore.createIndex('game_id', 'game_id', { unique: false });
			}

			// Sync queue store
			if (!database.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
				database.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
			}
		};
	});
}

// Games operations
export async function saveGamesToLocal(games: Game[]): Promise<void> {
	const database = await initDB();
	const tx = database.transaction(GAMES_STORE, 'readwrite');
	const store = tx.objectStore(GAMES_STORE);

	for (const game of games) {
		store.put(game);
	}

	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function getGamesFromLocal(): Promise<Game[]> {
	const database = await initDB();
	const tx = database.transaction(GAMES_STORE, 'readonly');
	const store = tx.objectStore(GAMES_STORE);

	return new Promise((resolve, reject) => {
		const request = store.getAll();
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function saveGameToLocal(game: Game): Promise<void> {
	const database = await initDB();
	const tx = database.transaction(GAMES_STORE, 'readwrite');
	const store = tx.objectStore(GAMES_STORE);

	return new Promise((resolve, reject) => {
		const request = store.put(game);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export async function deleteGameFromLocal(gameId: string): Promise<void> {
	const database = await initDB();
	const tx = database.transaction(GAMES_STORE, 'readwrite');
	const store = tx.objectStore(GAMES_STORE);

	return new Promise((resolve, reject) => {
		const request = store.delete(gameId);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

// Game notes operations
export async function saveNotesToLocal(notes: GameNote[]): Promise<void> {
	const database = await initDB();
	const tx = database.transaction(NOTES_STORE, 'readwrite');
	const store = tx.objectStore(NOTES_STORE);

	for (const note of notes) {
		store.put(note);
	}

	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function getNotesFromLocal(gameId: string): Promise<GameNote[]> {
	const database = await initDB();
	const tx = database.transaction(NOTES_STORE, 'readonly');
	const store = tx.objectStore(NOTES_STORE);
	const index = store.index('game_id');

	return new Promise((resolve, reject) => {
		const request = index.getAll(gameId);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function saveNoteToLocal(note: GameNote): Promise<void> {
	const database = await initDB();
	const tx = database.transaction(NOTES_STORE, 'readwrite');
	const store = tx.objectStore(NOTES_STORE);

	return new Promise((resolve, reject) => {
		const request = store.put(note);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export async function deleteNoteFromLocal(noteId: string): Promise<void> {
	const database = await initDB();
	const tx = database.transaction(NOTES_STORE, 'readwrite');
	const store = tx.objectStore(NOTES_STORE);

	return new Promise((resolve, reject) => {
		const request = store.delete(noteId);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

// Sync queue operations
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp'>): Promise<void> {
	const database = await initDB();
	const tx = database.transaction(SYNC_QUEUE_STORE, 'readwrite');
	const store = tx.objectStore(SYNC_QUEUE_STORE);

	const queueItem: SyncQueueItem = {
		...item,
		id: crypto.randomUUID(),
		timestamp: Date.now()
	};

	return new Promise((resolve, reject) => {
		const request = store.add(queueItem);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
	const database = await initDB();
	const tx = database.transaction(SYNC_QUEUE_STORE, 'readonly');
	const store = tx.objectStore(SYNC_QUEUE_STORE);

	return new Promise((resolve, reject) => {
		const request = store.getAll();
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function removeFromSyncQueue(itemId: string): Promise<void> {
	const database = await initDB();
	const tx = database.transaction(SYNC_QUEUE_STORE, 'readwrite');
	const store = tx.objectStore(SYNC_QUEUE_STORE);

	return new Promise((resolve, reject) => {
		const request = store.delete(itemId);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export async function clearSyncQueue(): Promise<void> {
	const database = await initDB();
	const tx = database.transaction(SYNC_QUEUE_STORE, 'readwrite');
	const store = tx.objectStore(SYNC_QUEUE_STORE);

	return new Promise((resolve, reject) => {
		const request = store.clear();
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}
