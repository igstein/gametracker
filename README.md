# 🎮 GameTracker

A minimalist, cross-platform app to track your game progress and stay motivated to finish what you started.

Built as a Progressive Web App (PWA) — installable on macOS, Linux, and iOS from a single codebase. Free to use.

---

## Features

- **Search and add games** via HowLongToBeat — cover images and completion times are pulled in automatically
- **Manual game entry** — add games without HLTB, with a custom target time and cover image (upload or URL)
- **Track playtime** — add or remove hours/minutes, see your progress against the HLTB community average
- **Priority levels** — mark games as Must Play, High, Medium, or Low priority
- **Status markers** — finished games get a green border and badge with dimmed cover; abandoned games get a gray badge with a darker dimmed cover
- **Next Up section** — shows the 3 best games to play next, scored by priority, progress, recency, genre diversity, and backlog age
- **Mood filter** — set a genre and/or platform mood above the Next Up section to boost matching games in the recommendations; resets daily at 7am
- **Genre tags** — tag games with one or more genres; used by the scoring algorithm to recommend variety
- **Platform tags** — tag games with the platforms you own (user-defined); used by the mood filter
- **Game journal** — private dated notes per game for strategies, session logs, or anything else
- **Filter and sort** — by status (Playing, Backlog, Finished, Abandoned), name, progress, priority, or last played
- **Configurable default view** — pin any filter as your default landing view
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
3. Click **Add** on the result you want
4. If a game isn't on HLTB, use **"Add manually"** to enter a custom target time and cover image

### Tracking progress
- Open any game card to add or remove playtime, change status, adjust priority, set genre tags, or set platform tags
- The progress bar turns red (0–30%), yellow (31–70%), and green (71–100%) as you play

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
