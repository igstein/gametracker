# Offline Support Documentation

GameTracker now works offline with automatic sync when you reconnect.

## Features

### 1. **Service Worker**
- Caches app shell (HTML, CSS, JS) for offline access
- Network-first strategy with cache fallback
- Auto-updates when new version available

### 2. **IndexedDB Storage**
- Local database stores games and notes
- Survives browser refreshes
- Automatic sync with Supabase

### 3. **Network Detection**
- Detects online/offline status automatically
- Shows yellow banner when offline
- Auto-syncs when connection returns

### 4. **Sync Queue**
- Queues operations performed offline
- Automatically syncs when back online
- Last-write-wins conflict resolution

## How It Works

### Online Mode (Default)
```
User Action → Supabase → IndexedDB Cache
              ↓
        Realtime Sync → Other Devices
```

### Offline Mode
```
User Action → IndexedDB → Sync Queue
              ↓
        Shows from cache

When back online:
Sync Queue → Supabase → All Devices
```

## What Works Offline

✅ **View game library** - All your games and progress
✅ **View journal entries** - Read your notes
✅ **Browse and filter** - Use all UI features

⏸️ **Requires online:**
- Adding new games (needs HLTB search)
- Authentication (needs Supabase)
- Realtime sync (needs WebSocket)

## What Syncs

When you reconnect, these changes sync automatically:
- Game updates (playtime, status, priority)
- Journal entries (create, edit, delete)
- Game additions/deletions

## Technical Details

### Storage Locations
- **Service Worker Cache**: `/static/service-worker.js`
- **IndexedDB**: `gametracker-db` (3 stores: games, game_notes, sync_queue)
- **localStorage**: Rate limiting, lockout state

### Browser Support
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (iOS 11.3+)
- Safari < 11.3: ⚠️ No Service Worker

### Data Flow
1. **Load**: Try Supabase → fallback to IndexedDB
2. **Save**: Write to IndexedDB + queue for sync
3. **Sync**: Process queue when online
4. **Realtime**: Live updates bypass queue

## Testing Offline Mode

### Chrome DevTools
1. Open DevTools (F12)
2. Go to **Network** tab
3. Check **Offline** in throttling dropdown
4. App should show yellow offline banner

### Firefox
1. Open DevTools (F12)
2. Go to **Network** tab
3. Click **Offline** button

### Safari
1. Open Web Inspector
2. Use **Network Throttling** → Offline

## Troubleshooting

### "Loaded from offline cache" error
- You're offline but cached data loaded successfully
- Changes will sync when you reconnect

### Service Worker not registering
- Check browser console for errors
- Ensure HTTPS (required for Service Workers)
- localhost is exempt from HTTPS requirement

### Sync queue not processing
- Check browser console for sync errors
- Manually refresh page to retry
- Queue persists until successfully synced

## Future Enhancements

- **Optimistic UI updates** - Show changes instantly before sync
- **Conflict resolution UI** - Handle edit conflicts
- **Manual sync button** - Force sync on demand
- **Sync status indicator** - Show pending changes count
- **Background sync** - Sync even when app is closed
