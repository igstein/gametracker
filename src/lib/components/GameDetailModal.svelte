<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { isOnline } from '$lib/stores/network';
	import type { Game, GameStatus, GamePriority, GameGenre, GameNote } from '$lib/types';
	import GameGuide from './GameGuide.svelte';

	const GENRES: GameGenre[] = [
		'Action', 'Action RPG', 'Adventure', 'Card Game', 'Fighting', 'First Person Shooter',
		'Horror', 'JRPG', 'MMORPG', 'Platformer', 'Point and Click', 'Puzzle', 'Racing',
		'RPG', 'Shooter', 'Simulation', 'Sports', 'Strategy', 'Stealth', 'Survival',
		'Tactical RPG', 'Visual Novel'
	];
	import { getTargetHours } from '$lib/utils';
	import type { RealtimeChannel } from '@supabase/supabase-js';
	import {
		saveNoteToLocal,
		deleteNoteFromLocal,
		deleteGameFromLocal,
		getNotesFromLocal,
		addToSyncQueue
	} from '$lib/services/offline';

	export let game: Game | null;
	export let open = false;
	export let onClose: () => void;
	export let onGameUpdated: () => void;
	export let onGameDeleted: () => void = () => {};
	export let availablePlatforms: string[] = [];
	export let availableDevices: string[] = [];
	export let availableSettings: string[] = [];
	export let playingGames: import('$lib/types').Game[] = [];

	$: supabase = $page.data.supabase;

	let hoursToAdd = 0;
	let minutesToAdd = 0;
	let subtractMode = false;
	let status: GameStatus = 'backlog';
	let priority: GamePriority = 'medium';
	let saving = false;
	let error = '';
	let confirmingDelete = false;
	let showFocusWarning = false;
	let editingTarget = false;
	let customTargetInput = 0;
	let editingGenres = false;
	let selectedGenres: GameGenre[] = [];
	let addingPlatform = false;
	let newPlatformInput = '';

	// Devices state
	let addingDevice = false;
	let newDeviceInput = '';

	// Setting state
	let addingSetting = false;
	let newSettingInput = '';

	// Journal state
	let notes: GameNote[] = [];
	let loadingNotes = false;
	let showAddNote = false;
	let noteTitle = '';
	let noteContent = '';
	let editingNoteId: string | null = null;
	let notesRealtimeChannel: RealtimeChannel | null = null;

	// Update local values when game changes
	$: if (game) {
		status = game.status;
		priority = game.priority;
		hoursToAdd = 0;
		minutesToAdd = 0;
		subtractMode = false;
		// Reset note form state
		showAddNote = false;
		noteTitle = '';
		noteContent = '';
		editingNoteId = null;
		confirmingDelete = false;
		showFocusWarning = false;
		editingTarget = false;
		customTargetInput = 0;
		editingGenres = false;
		selectedGenres = [...(game.genre ?? [])];
		addingPlatform = false;
		newPlatformInput = '';
		addingDevice = false;
		newDeviceInput = '';
		addingSetting = false;
		newSettingInput = '';
		loadNotes();
		setupNotesRealtimeSubscription();
	}

	// Clean up when modal closes
	$: if (!open && notesRealtimeChannel) {
		supabase.removeChannel(notesRealtimeChannel);
		notesRealtimeChannel = null;
	}

	$: targetHours = game ? getTargetHours(game) : 50;

	// Calculate progress
	$: progress = game ? Math.min(100, (game.played_hours / targetHours) * 100) : 0;

	// Progress bar color
	$: progressColor =
		progress < 30 ? 'bg-red-500' : progress < 70 ? 'bg-yellow-500' : 'bg-green-500';

	// Priority config
	const priorityConfig = {
		must_play: { icon: '★', label: 'Must Play' },
		high: { icon: '●', label: 'High' },
		medium: { icon: '●', label: 'Medium' },
		low: { icon: '○', label: 'Low' }
	};

	// Other playing games (excluding the current one)
	$: otherPlayingGames = playingGames.filter((g) => g.id !== game?.id);

	function handleUpdate() {
		if (!game) return;
		// Soft lock: warn if switching to Playing while other games are already Playing
		if (status === 'playing' && game.status !== 'playing' && otherPlayingGames.length > 0) {
			showFocusWarning = true;
			return;
		}
		handleUpdateConfirmed();
	}

	async function handleUpdateConfirmed() {
		if (!game) return;
		showFocusWarning = false;
		saving = true;
		error = '';

		try {
			const delta = hoursToAdd + minutesToAdd / 60;
			const newPlayedHours = Math.max(0, game.played_hours + (subtractMode ? -delta : delta));

			const { error: updateError } = await supabase
				.from('games')
				.update({
					played_hours: newPlayedHours,
					status,
					priority,
					last_played: new Date().toISOString()
				})
				.eq('id', game.id);

			if (updateError) throw updateError;

			onGameUpdated();
			onClose();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update game';
		} finally {
			saving = false;
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	async function handleDelete() {
		if (!game) return;

		saving = true;
		error = '';

		try {
			if ($isOnline) {
				const { error: deleteError } = await supabase
					.from('games')
					.delete()
					.eq('id', game.id);

				if (deleteError) throw deleteError;
			} else {
				await deleteGameFromLocal(game.id);
				await addToSyncQueue({
					operation: 'delete',
					table: 'games',
					data: { id: game.id }
				});
			}

			onGameDeleted();
			onClose();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete game';
			confirmingDelete = false;
		} finally {
			saving = false;
		}
	}

	async function saveCustomTarget() {
		if (!game) return;
		saving = true;
		error = '';
		try {
			const { error: updateError } = await supabase
				.from('games')
				.update({ custom_target_hours: customTargetInput })
				.eq('id', game.id);
			if (updateError) throw updateError;
			game = { ...game, custom_target_hours: customTargetInput };
			editingTarget = false;
			onGameUpdated();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update target';
		} finally {
			saving = false;
		}
	}

	async function clearCustomTarget() {
		if (!game) return;
		saving = true;
		error = '';
		try {
			const { error: updateError } = await supabase
				.from('games')
				.update({ custom_target_hours: null })
				.eq('id', game.id);
			if (updateError) throw updateError;
			game = { ...game, custom_target_hours: null };
			onGameUpdated();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to reset target';
		} finally {
			saving = false;
		}
	}

	// Journal functions
	async function loadNotes() {
		if (!game) return;

		loadingNotes = true;
		try {
			if ($isOnline) {
				// Online: load from Supabase
				const { data, error: fetchError } = await supabase
					.from('game_notes')
					.select('*')
					.eq('game_id', game.id)
					.order('created_at', { ascending: false });

				if (fetchError) throw fetchError;

				notes = data || [];
			} else {
				// Offline: load from IndexedDB
				console.log('[Offline] Loading notes from local cache');
				notes = await getNotesFromLocal(game.id);
				notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
			}
		} catch (e) {
			console.error('Error loading notes:', e);
			// Try loading from cache as fallback
			try {
				notes = await getNotesFromLocal(game.id);
				notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
			} catch {
				notes = [];
			}
		} finally {
			loadingNotes = false;
		}
	}

	function openAddNote() {
		noteTitle = '';
		noteContent = '';
		editingNoteId = null;
		showAddNote = true;
	}

	function openEditNote(note: GameNote) {
		noteTitle = note.title || '';
		noteContent = note.content;
		editingNoteId = note.id;
		showAddNote = true;
	}

	function cancelNoteEdit() {
		showAddNote = false;
		noteTitle = '';
		noteContent = '';
		editingNoteId = null;
	}

	async function saveNote() {
		if (!game || !noteContent.trim()) return;

		saving = true;
		error = '';

		try {
			if (!$page.data.user) {
				error = 'You must be logged in to save notes';
				saving = false;
				return;
			}

			const noteData = {
				game_id: game.id,
				user_id: $page.data.user.id,
				title: noteTitle.trim() || null,
				content: noteContent.trim()
			};

			if (editingNoteId) {
				// Update existing note
				const updatedNote = {
					...noteData,
					id: editingNoteId,
					updated_at: new Date().toISOString()
				};

				if ($isOnline) {
					const { error: updateError } = await supabase
						.from('game_notes')
						.update({
							title: updatedNote.title,
							content: updatedNote.content,
							updated_at: updatedNote.updated_at
						})
						.eq('id', editingNoteId);

					if (updateError) {
						console.error('Update error:', updateError);
						throw updateError;
					}
				} else {
					// Offline: save to IndexedDB and queue
					console.log('[Offline] Queuing note update');
					await saveNoteToLocal(updatedNote as GameNote);
					await addToSyncQueue({
						operation: 'update',
						table: 'game_notes',
						data: updatedNote
					});
				}
			} else {
				// Create new note
				const newNote = {
					...noteData,
					id: crypto.randomUUID(),
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				};

				if ($isOnline) {
					const { error: insertError } = await supabase.from('game_notes').insert(noteData);

					if (insertError) {
						console.error('Insert error:', insertError);
						throw insertError;
					}
				} else {
					// Offline: save to IndexedDB and queue
					console.log('[Offline] Queuing note insert');
					await saveNoteToLocal(newNote as GameNote);
					await addToSyncQueue({
						operation: 'insert',
						table: 'game_notes',
						data: newNote
					});
				}
			}

			await loadNotes();
			cancelNoteEdit();
		} catch (e) {
			console.error('Save note error:', e);
			error = e instanceof Error ? e.message : 'Failed to save note';
		} finally {
			saving = false;
		}
	}

	async function deleteNote(noteId: string) {
		if (!confirm('Delete this journal entry?')) return;

		try {
			if ($isOnline) {
				const { error: deleteError } = await supabase
					.from('game_notes')
					.delete()
					.eq('id', noteId);

				if (deleteError) throw deleteError;
			} else {
				// Offline: delete from IndexedDB and queue
				console.log('[Offline] Queuing note delete');
				await deleteNoteFromLocal(noteId);
				await addToSyncQueue({
					operation: 'delete',
					table: 'game_notes',
					data: { id: noteId }
				});
			}

			await loadNotes();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete note';
		}
	}

	function setupNotesRealtimeSubscription() {
		if (!game) return;

		// Remove existing subscription if any
		if (notesRealtimeChannel) {
			supabase.removeChannel(notesRealtimeChannel);
		}

		// Subscribe to changes for this game's notes
		notesRealtimeChannel = supabase
			.channel(`game-notes-${game.id}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'game_notes',
					filter: `game_id=eq.${game.id}`
				},
				(payload) => {
					console.log('Note realtime update:', payload);

					if (payload.eventType === 'INSERT') {
						const newNote = payload.new as GameNote;
						notes = [newNote, ...notes];
					} else if (payload.eventType === 'UPDATE') {
						const updatedNote = payload.new as GameNote;
						notes = notes.map((n) => (n.id === updatedNote.id ? updatedNote : n));
					} else if (payload.eventType === 'DELETE') {
						const deletedNote = payload.old as GameNote;
						notes = notes.filter((n) => n.id !== deletedNote.id);
					}
				}
			)
			.subscribe((status) => {
				console.log('Notes realtime status:', status);
			});
	}

	async function saveGenres() {
		if (!game) return;
		saving = true;
		error = '';
		try {
			const { error: updateError } = await supabase
				.from('games')
				.update({ genre: selectedGenres.length ? selectedGenres : null })
				.eq('id', game.id);
			if (updateError) throw updateError;
			game = { ...game, genre: selectedGenres.length ? selectedGenres : null };
			editingGenres = false;
			onGameUpdated();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save genres';
		} finally {
			saving = false;
		}
	}

	async function savePlatforms(platforms: string[]) {
		if (!game) return;
		saving = true;
		error = '';
		try {
			const { error: updateError } = await supabase
				.from('games')
				.update({ platform: platforms.length ? platforms : null })
				.eq('id', game.id);
			if (updateError) throw updateError;
			game = { ...game, platform: platforms.length ? platforms : null };
			onGameUpdated();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save platforms';
		} finally {
			saving = false;
		}
	}

	async function deletePlatform(p: string) {
		if (!game) return;
		const updated = (game.platform ?? []).filter((x) => x !== p);
		await savePlatforms(updated);
	}

	async function addPlatform() {
		if (!game) return;
		const trimmed = newPlatformInput.trim();
		if (!trimmed) return;
		const current = game.platform ?? [];
		if (!current.includes(trimmed)) {
			await savePlatforms([...current, trimmed]);
		}
		newPlatformInput = '';
		addingPlatform = false;
	}

	async function saveDevices(devices: string[]) {
		if (!game) return;
		saving = true;
		error = '';
		try {
			const { error: updateError } = await supabase
				.from('games')
				.update({ devices: devices.length ? devices : null })
				.eq('id', game.id);
			if (updateError) throw updateError;
			game = { ...game, devices: devices.length ? devices : null };
			onGameUpdated();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save devices';
		} finally {
			saving = false;
		}
	}

	async function saveSettings(settings: string[]) {
		if (!game) return;
		saving = true;
		error = '';
		try {
			const { error: updateError } = await supabase
				.from('games')
				.update({ setting: settings.length ? settings : null })
				.eq('id', game.id);
			if (updateError) throw updateError;
			game = { ...game, setting: settings.length ? settings : null };
			onGameUpdated();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save settings';
		} finally {
			saving = false;
		}
	}

	async function deleteSetting(s: string) {
		if (!game) return;
		const updated = (game.setting ?? []).filter((x) => x !== s);
		await saveSettings(updated);
	}

	async function addSetting() {
		if (!game) return;
		const trimmed = newSettingInput.trim();
		if (!trimmed) return;
		const current = game.setting ?? [];
		if (!current.includes(trimmed)) {
			await saveSettings([...current, trimmed]);
		}
		newSettingInput = '';
		addingSetting = false;
	}

	async function deleteDevice(d: string) {
		if (!game) return;
		const updated = (game.devices ?? []).filter((x) => x !== d);
		await saveDevices(updated);
	}

	async function addDevice() {
		if (!game) return;
		const trimmed = newDeviceInput.trim();
		if (!trimmed) return;
		const current = game.devices ?? [];
		if (!current.includes(trimmed)) {
			await saveDevices([...current, trimmed]);
		}
		newDeviceInput = '';
		addingDevice = false;
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	onDestroy(() => {
		// Clean up Realtime subscription
		if (notesRealtimeChannel) {
			supabase.removeChannel(notesRealtimeChannel);
		}
	});
</script>

{#if open && game}
	<div
		class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
		on:click={handleBackdropClick}
		role="button"
		tabindex="-1"
	>
		<div class="bg-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
			<div class="flex items-start justify-between mb-6">
				<div>
					<h2 class="text-2xl font-bold text-white mb-2">{game.title}</h2>
					<div class="flex items-center gap-2 text-sm text-gray-400">
						<span>Status: {status}</span>
						<span>•</span>
						<span>Priority: {priorityConfig[priority].icon} {priorityConfig[priority].label}</span>
					</div>
					<div class="mt-3">
						{#if !editingGenres}
							<div class="flex flex-wrap gap-1.5 items-center">
								{#if game.genre?.length}
									{#each game.genre as g}
										<span class="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full">{g}</span>
									{/each}
								{:else}
									<span class="text-gray-500 text-xs">No genres set</span>
								{/if}
								<button
									type="button"
									on:click={() => { selectedGenres = [...(game?.genre ?? [])]; editingGenres = true; }}
									class="text-gray-500 hover:text-gray-300 text-xs ml-1"
								>Edit</button>
							</div>
						{:else}
							<div class="bg-gray-700 rounded-lg p-3 mt-1">
								<div class="flex flex-wrap gap-2 mb-3">
									{#each GENRES as g}
										<button
											type="button"
											on:click={() => selectedGenres = selectedGenres.includes(g) ? selectedGenres.filter(x => x !== g) : [...selectedGenres, g]}
											class="px-2 py-0.5 text-xs rounded-full transition-colors {selectedGenres.includes(g) ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}"
										>{g}</button>
									{/each}
								</div>
								<div class="flex gap-2">
									<button type="button" on:click={() => editingGenres = false} class="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded-lg transition-colors">Cancel</button>
									<button type="button" on:click={saveGenres} disabled={saving} class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50">Save</button>
								</div>
							</div>
						{/if}
					</div>
					<!-- Platform -->
					<div class="mt-2">
						<div class="flex flex-wrap gap-1.5 items-center">
							{#if game.platform?.length}
								{#each game.platform as p}
									<span class="flex items-center gap-1 px-2 py-0.5 bg-indigo-900/50 text-indigo-300 text-xs rounded-full">
										{p}
										<button type="button" on:click={() => deletePlatform(p)} disabled={saving} class="text-indigo-400 hover:text-white leading-none disabled:opacity-50">×</button>
									</span>
								{/each}
							{/if}
							{#if !addingPlatform}
								<button type="button" on:click={() => (addingPlatform = true)} class="text-gray-500 hover:text-gray-300 text-xs">+ platform</button>
							{/if}
						</div>
						{#if addingPlatform}
							<div class="mt-2 bg-gray-700 rounded-lg p-2.5">
								{#if availablePlatforms.filter(p => !(game?.platform ?? []).includes(p)).length > 0}
									<div class="flex flex-wrap gap-1.5 mb-2">
										{#each availablePlatforms.filter(p => !(game?.platform ?? []).includes(p)) as p}
											<button type="button" on:click={() => { newPlatformInput = p; addPlatform(); }} class="px-2 py-0.5 text-xs rounded-full bg-gray-600 text-gray-300 hover:bg-indigo-600 hover:text-white transition-colors">{p}</button>
										{/each}
									</div>
								{/if}
								<div class="flex gap-2">
									<input type="text" bind:value={newPlatformInput} placeholder="e.g. SNES, PS5, PC" on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addPlatform())} class="flex-1 px-2 py-1 bg-gray-600 text-white text-xs rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
									<button type="button" on:click={addPlatform} disabled={saving || !newPlatformInput.trim()} class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50">Add</button>
									<button type="button" on:click={() => { addingPlatform = false; newPlatformInput = ''; }} class="px-2.5 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded-lg transition-colors">✕</button>
								</div>
							</div>
						{/if}
					</div>

					<!-- Devices -->
					<div class="mt-2">
						<div class="flex flex-wrap gap-1.5 items-center">
							{#if game.devices?.length}
								{#each game.devices as d}
									<span class="flex items-center gap-1 px-2 py-0.5 bg-teal-900/50 text-teal-300 text-xs rounded-full">
										{d}
										<button type="button" on:click={() => deleteDevice(d)} disabled={saving} class="text-teal-400 hover:text-white leading-none disabled:opacity-50">×</button>
									</span>
								{/each}
							{/if}
							{#if !addingDevice}
								<button type="button" on:click={() => (addingDevice = true)} class="text-gray-500 hover:text-gray-300 text-xs">+ device</button>
							{/if}
						</div>
						{#if addingDevice}
							<div class="mt-2 bg-gray-700 rounded-lg p-2.5">
								{#if availableDevices.filter(d => !(game?.devices ?? []).includes(d)).length > 0}
									<div class="flex flex-wrap gap-1.5 mb-2">
										{#each availableDevices.filter(d => !(game?.devices ?? []).includes(d)) as d}
											<button type="button" on:click={() => { newDeviceInput = d; addDevice(); }} class="px-2 py-0.5 text-xs rounded-full bg-gray-600 text-gray-300 hover:bg-teal-600 hover:text-white transition-colors">{d}</button>
										{/each}
									</div>
								{/if}
								<div class="flex gap-2">
									<input type="text" bind:value={newDeviceInput} placeholder="e.g. Odin2, Steam Deck" on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addDevice())} class="flex-1 px-2 py-1 bg-gray-600 text-white text-xs rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
									<button type="button" on:click={addDevice} disabled={saving || !newDeviceInput.trim()} class="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50">Add</button>
									<button type="button" on:click={() => { addingDevice = false; newDeviceInput = ''; }} class="px-2.5 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded-lg transition-colors">✕</button>
								</div>
							</div>
						{/if}
					</div>

					<!-- Setting -->
					<div class="mt-2">
						<div class="flex flex-wrap gap-1.5 items-center">
							{#if game.setting?.length}
								{#each game.setting as s}
									<span class="flex items-center gap-1 px-2 py-0.5 bg-amber-900/50 text-amber-300 text-xs rounded-full">
										{s}
										<button type="button" on:click={() => deleteSetting(s)} disabled={saving} class="text-amber-400 hover:text-white leading-none disabled:opacity-50">×</button>
									</span>
								{/each}
							{/if}
							{#if !addingSetting}
								<button type="button" on:click={() => (addingSetting = true)} class="text-gray-500 hover:text-gray-300 text-xs">+ setting</button>
							{/if}
						</div>
						{#if addingSetting}
							<div class="mt-2 bg-gray-700 rounded-lg p-2.5">
								{#if availableSettings.filter(s => !(game?.setting ?? []).includes(s)).length > 0}
									<div class="flex flex-wrap gap-1.5 mb-2">
										{#each availableSettings.filter(s => !(game?.setting ?? []).includes(s)) as s}
											<button type="button" on:click={() => { newSettingInput = s; addSetting(); }} class="px-2 py-0.5 text-xs rounded-full bg-gray-600 text-gray-300 hover:bg-amber-600 hover:text-white transition-colors">{s}</button>
										{/each}
									</div>
								{/if}
								<div class="flex gap-2">
									<input type="text" bind:value={newSettingInput} placeholder="e.g. Fantasy, Sci-Fi, Warhammer 40K" on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addSetting())} class="flex-1 px-2 py-1 bg-gray-600 text-white text-xs rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
									<button type="button" on:click={addSetting} disabled={saving || !newSettingInput.trim()} class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50">Add</button>
									<button type="button" on:click={() => { addingSetting = false; newSettingInput = ''; }} class="px-2.5 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded-lg transition-colors">✕</button>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Progress Section (hidden for wishlist) -->
			{#if game.status !== 'wishlist'}
			<div class="bg-gray-700 rounded-lg p-4 mb-6">
				<div class="flex justify-between text-sm text-gray-300 mb-2">
					<span>Progress</span>
					<span>{progress.toFixed(1)}%</span>
				</div>
				<div class="w-full bg-gray-600 rounded-full h-3 overflow-hidden mb-3">
					<div class="{progressColor} h-full transition-all" style="width: {progress}%"></div>
				</div>
				<div class="flex justify-between text-sm">
					<span class="text-white font-semibold">{game.played_hours.toFixed(1)} hours played</span>
					<div class="flex items-center gap-2">
						{#if editingTarget}
							<input
								type="number"
								bind:value={customTargetInput}
								min="1"
								step="0.5"
								class="w-24 px-2 py-1 bg-gray-600 text-white text-sm rounded focus:ring-2 focus:ring-blue-500 outline-none"
							/>
							<span class="text-gray-400 text-sm">h</span>
							<button
								type="button"
								on:click={saveCustomTarget}
								disabled={saving}
								class="text-blue-400 hover:text-blue-300 text-xs disabled:opacity-50"
							>Save</button>
							<button
								type="button"
								on:click={() => (editingTarget = false)}
								class="text-gray-500 hover:text-gray-400 text-xs"
							>Cancel</button>
						{:else}
							<span class="text-gray-400">
								Target: {targetHours.toFixed(0)}h
								{#if game.custom_target_hours != null}
									<span class="text-xs text-yellow-500 ml-1">(custom)</span>
								{/if}
							</span>
							<button
								type="button"
								on:click={() => { customTargetInput = targetHours; editingTarget = true; }}
								class="text-gray-500 hover:text-gray-300 text-xs"
							>Edit</button>
							{#if game.custom_target_hours != null}
								<button
									type="button"
									on:click={clearCustomTarget}
									disabled={saving}
									class="text-gray-500 hover:text-gray-300 text-xs disabled:opacity-50"
								>Reset to HLTB</button>
							{/if}
						{/if}
					</div>
				</div>
			</div>
			{/if}

			<!-- HLTB Times (shown for wishlist) -->
			{#if game.status === 'wishlist'}
			<div class="bg-gray-700 rounded-lg p-4 mb-6">
				<div class="flex justify-between items-center mb-3">
					<h4 class="text-sm font-medium text-gray-300">HowLongToBeat</h4>
					{#if targetHours > 0}
						<span class="text-white font-semibold text-sm">Target: {Math.round(targetHours)}h</span>
					{/if}
				</div>
				<div class="grid grid-cols-3 gap-3 text-center">
					<div>
						<p class="text-xs text-gray-400">Main Story</p>
						<p class="text-white font-semibold">{game.main_story_hours ? Math.round(game.main_story_hours) + 'h' : '—'}</p>
					</div>
					<div>
						<p class="text-xs text-gray-400">Main + Extras</p>
						<p class="text-white font-semibold">{game.main_plus_extras_hours ? Math.round(game.main_plus_extras_hours) + 'h' : '—'}</p>
					</div>
					<div>
						<p class="text-xs text-gray-400">Completionist</p>
						<p class="text-white font-semibold">{game.completionist_hours ? Math.round(game.completionist_hours) + 'h' : '—'}</p>
					</div>
				</div>
			</div>
			{/if}

			<!-- Update Form -->
			<form on:submit|preventDefault={handleUpdate} class="space-y-4">
				<!-- Add Playtime (hidden for wishlist) -->
				{#if status !== 'wishlist'}
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-2">Adjust Playtime</label>
					<div class="flex gap-2 mb-2">
						<button
							type="button"
							on:click={() => { subtractMode = false; }}
							class="px-3 py-1 text-sm rounded-lg transition-colors {!subtractMode ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
						>
							+ Add
						</button>
						<button
							type="button"
							on:click={() => { subtractMode = true; }}
							class="px-3 py-1 text-sm rounded-lg transition-colors {subtractMode ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
						>
							− Remove
						</button>
					</div>
					<div class="flex gap-3">
						<div class="flex-1">
							<input
								type="number"
								bind:value={hoursToAdd}
								min="0"
								placeholder="Hours"
								class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
							/>
						</div>
						<div class="flex-1">
							<input
								type="number"
								bind:value={minutesToAdd}
								min="0"
								max="59"
								placeholder="Minutes"
								class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
							/>
						</div>
					</div>
					<p class="text-xs text-gray-500 mt-1">
						{#if hoursToAdd > 0 || minutesToAdd > 0}
							{@const delta = hoursToAdd + minutesToAdd / 60}
							{@const newTotal = Math.max(0, game.played_hours + (subtractMode ? -delta : delta))}
							New total: {newTotal.toFixed(1)} hours ({subtractMode ? '−' : '+'}{delta.toFixed(1)}h)
						{:else}
							Enter hours and/or minutes to {subtractMode ? 'remove' : 'add'}
						{/if}
					</p>
				</div>
				{/if}

				<!-- Status -->
				<div>
					<label for="status" class="block text-sm font-medium text-gray-300 mb-2">Status</label>
					<select
						id="status"
						bind:value={status}
						class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
					>
						<option value="wishlist">💫 Wishlist</option>
						<option value="backlog">Backlog</option>
						<option value="playing">Playing</option>
						<option value="finished">Finished</option>
						<option value="abandoned">Abandoned</option>
					</select>
				</div>

				<!-- Priority -->
				<div>
					<label for="priority" class="block text-sm font-medium text-gray-300 mb-2">Priority</label>
					<select
						id="priority"
						bind:value={priority}
						class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
					>
						<option value="must_play">★ Must Play</option>
						<option value="high">● High</option>
						<option value="medium">● Medium</option>
						<option value="low">○ Low</option>
					</select>
				</div>

				{#if error}
					<div class="text-red-500 text-sm">{error}</div>
				{/if}

				<!-- Focus warning -->
				{#if showFocusWarning}
					<div class="p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
						<p class="text-yellow-300 text-sm font-medium mb-1">You're already playing:</p>
						<ul class="mb-3 space-y-0.5">
							{#each otherPlayingGames as g}
								<li class="text-yellow-200 text-sm">• {g.title}</li>
							{/each}
						</ul>
						<p class="text-yellow-400 text-xs mb-3">Focusing on one game at a time helps you finish it. Are you sure?</p>
						<div class="flex gap-2">
							<button
								type="button"
								on:click={() => (showFocusWarning = false)}
								class="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
							>
								Cancel
							</button>
							<button
								type="button"
								on:click={handleUpdateConfirmed}
								disabled={saving}
								class="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
							>
								Play anyway
							</button>
						</div>
					</div>
				{:else}
				<!-- Buttons -->
				<div class="flex gap-3 pt-4">
					<button
						type="button"
						on:click={onClose}
						disabled={saving}
						class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={saving}
						class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
					>
						{saving ? 'Updating...' : 'Update Game'}
					</button>
				</div>
				{/if}

				<!-- Delete -->
				{#if !confirmingDelete}
					<button
						type="button"
						on:click={() => (confirmingDelete = true)}
						disabled={saving}
						class="w-full mt-2 px-4 py-2 text-red-400 hover:text-red-300 text-sm transition-colors disabled:opacity-50"
					>
						Delete game
					</button>
				{:else}
					<div class="mt-2 p-4 bg-red-900/30 border border-red-700 rounded-lg">
						<p class="text-red-300 text-sm font-medium mb-3">
							Delete "{game.title}"? This cannot be undone.
						</p>
						<div class="flex gap-3">
							<button
								type="button"
								on:click={() => (confirmingDelete = false)}
								disabled={saving}
								class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
							<button
								type="button"
								on:click={handleDelete}
								disabled={saving}
								class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
							>
								{saving ? 'Deleting...' : 'Yes, delete'}
							</button>
						</div>
					</div>
				{/if}
			</form>

			<!-- Guide Section -->
			<GameGuide
				gameId={game.id}
				guideUrl={game.guide_url ?? null}
				guideText={game.guide_text ?? null}
				onUpdated={onGameUpdated}
			/>

			<!-- Journal Section -->
			<div class="mt-8 pt-8 border-t border-gray-700">
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-bold text-white">📝 Journal</h3>
					{#if !showAddNote}
						<button
							on:click={openAddNote}
							class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
						>
							+ Add Entry
						</button>
					{/if}
				</div>

				<!-- Add/Edit Note Form -->
				{#if showAddNote}
					<div class="bg-gray-700 rounded-lg p-4 mb-4">
						<div class="space-y-3">
							<input
								type="text"
								bind:value={noteTitle}
								placeholder="Title (optional)"
								class="w-full px-3 py-2 bg-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
							/>
							<textarea
								bind:value={noteContent}
								placeholder="What's on your mind about this game?"
								rows="4"
								class="w-full px-3 py-2 bg-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
							></textarea>
							<div class="flex gap-2">
								<button
									on:click={cancelNoteEdit}
									disabled={saving}
									class="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
								>
									Cancel
								</button>
								<button
									on:click={saveNote}
									disabled={saving || !noteContent.trim()}
									class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
								>
									{saving ? 'Saving...' : editingNoteId ? 'Update' : 'Save'}
								</button>
							</div>
						</div>
					</div>
				{/if}

				<!-- Notes List -->
				{#if loadingNotes}
					<p class="text-gray-400 text-sm text-center py-4">Loading journal entries...</p>
				{:else if notes.length > 0}
					<div class="space-y-4">
						{#each notes as note (note.id)}
							<div class="bg-gray-700 rounded-lg p-4">
								<div class="flex justify-between items-start mb-2">
									<div class="flex-1">
										{#if note.title}
											<h4 class="text-white font-medium text-sm mb-1">{note.title}</h4>
										{/if}
										<p class="text-gray-400 text-xs">{formatDate(note.created_at)}</p>
									</div>
									<div class="flex gap-2">
										<button
											on:click={() => openEditNote(note)}
											class="text-blue-400 hover:text-blue-300 text-xs"
										>
											Edit
										</button>
										<button
											on:click={() => deleteNote(note.id)}
											class="text-red-400 hover:text-red-300 text-xs"
										>
											Delete
										</button>
									</div>
								</div>
								<p class="text-gray-300 text-sm whitespace-pre-wrap">{note.content}</p>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-gray-500 text-sm text-center py-8">
						No journal entries yet. Click "Add Entry" to start tracking your thoughts about this game.
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
