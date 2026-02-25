# 🎮 GameTracker

A minimalist, cross-platform app to track your game progress and stay motivated to finish what you started.

Built as a Progressive Web App (PWA) — installable on macOS, Linux, and iOS from a single codebase. Free to use.

---

## Features

- **Search and add games** via HowLongToBeat — cover images and completion times are pulled in automatically
- **Track playtime** and see your progress against the HLTB community average
- **Priority levels** — mark games as Must Play, High, Medium, or Low priority
- **Next Up section** — always shows the 3 games closest to completion to keep you motivated
- **Game journal** — private dated notes per game for strategies, session logs, or anything else
- **Filter and sort** — by status (Playing, Backlog, Finished, Abandoned), name, progress, priority, or last played
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
4. If a game isn't on HLTB, use **"Add manually"** to enter a custom target time

### Tracking progress
- Open any game card to update your playtime, change status, or adjust priority
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
