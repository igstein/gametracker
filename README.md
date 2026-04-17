# 🎮 GameTracker

A minimalist, cross-platform app to track your game progress and stay motivated to finish what you started.

Built as a Progressive Web App (PWA) — installable on macOS, Linux, and iOS from a single codebase. Free to use.

---

## Features

### Library & Discovery
- **Search and add games** via HowLongToBeat — cover images and completion times are pulled in automatically
- **Manual game entry** — add games without HLTB, with a custom target time and cover image (upload or URL)
- **Duplicate detection** — search results are marked if a game is already in your library or wishlist, and adding it twice is blocked
- **Wishlist** — a separate section for games you want to play in the future; excluded from scoring and the main library view; shows HLTB times and a calculated target length

### Progress & Status
- **Track playtime** — add or remove hours/minutes, see your progress against the HLTB community average
- **Priority levels** — mark games as Must Play (★), High (●), Medium (●), or Low (○) priority
- **Status markers** — finished games get a green border and badge with dimmed cover; abandoned games get a gray badge with a darker dimmed cover
- **Soft lock on Playing status** — if you set a game to Playing while others are already Playing, the app warns you with their names and asks you to confirm

### Focus & Recommendations
- **Focus Week** — commit to exactly 3 games for 7 days; focus cards sit prominently above Next Up with cover, priority, status, progress bar, and remaining hours; locked for the full week with an early-reset escape hatch
- **Next Up section** — collapsible section showing the 3 best games to play next, scored by 11 factors: priority, remaining time, progress, started-bonus, short-game boost, recency, genre diversity, backlog age, Playing status, and mood
- **Mood filter** — set a genre, setting, and/or device mood above Next Up to boost matching games in the recommendations; resets daily at 7am

### Tagging
- **Genre tags** — tag games with one or more genres; used by Next Up scoring to recommend variety
- **Platform tags** — tag games with the platforms the game runs on (user-defined); filterable from the sidebar
- **Device tags** — tag games with the device you actually play them on (e.g. Odin2, Steam Deck); used by the mood filter
- **Setting tags** — free-form tags for thematic universe or franchise (e.g. Fantasy, Sci-Fi, Warhammer 40K); used by the mood filter
- **Guide** — attach a URL or free-text notes to a game as a strategy guide or reference

### Organisation
- **Filter and sort** — by status (Playing, Backlog, Finished, Abandoned), name, progress, priority, last played, or remaining time
- **Platform filter** — filter the library by a specific platform from the sidebar dropdown
- **Configurable default view** — pin any status filter as your default landing view

### App & Sync
- **Game journal** — private dated notes per game for strategies, session logs, or anything else
- **Dark and light mode** — toggleable, persists across sessions
- **Offline support** — works without internet, syncs when you reconnect
- **Cross-device sync** — changes appear in real time across all your devices
- **JSON backup** — export all your data and import it back at any time
- **Keyboard shortcuts** — press `?` in the app to see the full list

---

## How to Use

### Adding a game
1. Click **+ Add Game** in the sidebar (or press `N`)
2. Search for the game by name — results come from HowLongToBeat
3. Click **Add** to add it to your backlog, or **💫 Wishlist** to save it for later
4. Games already in your library are marked in the results and cannot be added again
5. If a game isn't on HLTB, use **"Add manually"** to enter a custom target time and cover image

### Tracking progress
- Open any game card to add or remove playtime, change status, adjust priority, or manage tags
- The progress bar turns red (0–30%), yellow (31–70%), and green (71–100%) as you play

### Focus Week
- Click **Set focus games →** in the Focus Week section to pick 3 games you commit to this week
- The selection is locked for 7 days; use "reset early" if you need to change it before then

### Next Up & Mood
- Next Up recommends 3 games based on your library, playing history, and priorities
- Click **+ mood** to set a genre, setting, or device mood — matching games get a scoring boost
- Collapse or expand Next Up using the toggle arrow to keep Focus Week front and centre

### Journal
- Open a game and scroll to the Journal section
- Add dated entries for notes, strategies, or session logs
- Entries are strictly private — only visible to you

### Backup
- Use **↓ Export** in the sidebar to download a JSON backup of all your games and notes
- Use **↑ Import** to restore from a backup file

### Installing as a PWA
- **macOS / Linux:** Open in Chrome or Firefox → address bar → install icon
- **iOS:** Open in Safari → Share → "Add to Home Screen"

---

## Tech Stack

| Component | Technology |
|---|---|
| Framework | SvelteKit + TypeScript |
| Styling | Tailwind CSS v4 |
| Backend / Database | Supabase (PostgreSQL + Realtime) |
| Auth | Supabase Auth |
| Offline | Service Worker + IndexedDB |
| Hosting | Vercel |

---

## Running Locally

```bash
# Install dependencies
npm install

# Create a .env file with your Supabase credentials
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Start the dev server
npm run dev
```

---

## Credits

Built with the help of [Claude AI](https://claude.ai) by Anthropic.

Completion times from [HowLongToBeat](https://howlongtobeat.com).
